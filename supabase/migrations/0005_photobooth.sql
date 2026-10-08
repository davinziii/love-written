-- Love, Written — Photobooth (two-person digital photobooth, V1)
-- Run AFTER 0001–0004. Safe to run once.
--
-- Design notes (see docs/PHOTOBOOTH.md):
--   • The database is the source of truth. Every state change goes through one of the
--     pb_* functions below, which lock the session row (FOR UPDATE) so simultaneous
--     clicks from both people can never double-advance a round or skip a check.
--   • Participant links are credentials: only SHA-256 hashes are stored for checking;
--     an AES-GCM encrypted copy (token_enc, key on the server) lets Person A see the
--     invite link and lets support re-send links.
--   • Retention: the 7-day clock starts at COMPLETED (completed_at → expires_at), never
--     at payment. Camera trouble never moves a paid session to a failure state.
--   • Like every table, RLS is on with no policies: only the server (service role) reads.

-- ─── Sessions ────────────────────────────────────────────────────────────────

create table photobooth_sessions (
  id                     uuid primary key default gen_random_uuid(),
  status                 text not null default 'AWAITING_PAYMENT' check (status in (
                           'AWAITING_PAYMENT',     -- created, waiting for PayMongo
                           'PAID',                 -- paid: camera check, invite, frame, notice (recoverable)
                           'IN_PROGRESS',          -- taking the 4 photos
                           'GENERATING',           -- all 4 approved, building the strip
                           'FINALIZATION_FAILED',  -- strip generation failed repeatedly (retryable)
                           'COMPLETED',            -- strip ready; 7-day retention running
                           'EXPIRED',              -- retention over, waiting for cleanup
                           'CLEANUP_FAILED',       -- deletion failed after automatic retries
                           'DELETED')),            -- photos + participant access removed
  payment_status         payment_status not null default 'UNPAID',
  price_centavos         int not null check (price_centavos >= 0),
  create_key             text unique,             -- self-serve creation idempotency key
  frame_id               text,
  current_round          int not null default 1 check (current_round between 1 and 4),
  attempt                int not null default 1, -- increases on every new round or retake
  round_phase            text check (round_phase in ('READY', 'COUNTDOWN', 'REVIEW')),
  capture_at             timestamptz,             -- synchronized shutter moment (server clock)
  realtime_key           text not null default encode(gen_random_bytes(16), 'hex'),
  output_path            text,
  generation_claimed_at  timestamptz,
  generation_attempts    int not null default 0,
  generation_error       text,
  paid_at                timestamptz,
  completed_at           timestamptz,
  expires_at             timestamptz,
  last_activity_at       timestamptz not null default now(),
  cleanup_reason         text check (cleanup_reason in ('expired', 'idle', 'unpaid', 'admin')),
  cleanup_attempts       int not null default 0,
  cleanup_next_at        timestamptz,
  cleanup_error          text,
  deleted_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index photobooth_sessions_status_idx on photobooth_sessions (status, updated_at desc);
create index photobooth_sessions_expiry_idx on photobooth_sessions (expires_at) where status = 'COMPLETED';

-- ─── Participants (exactly two: A pays, B is invited) ────────────────────────

create table photobooth_participants (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references photobooth_sessions (id) on delete cascade,
  role             text not null check (role in ('A', 'B')),
  token_hash       text not null unique,
  token_enc        text,
  device_id        text check (char_length(device_id) <= 64),
  joined_at        timestamptz,
  last_seen_at     timestamptz,
  camera_ready_at  timestamptz,
  camera_issue     text check (camera_issue in ('denied', 'unavailable', 'in_use', 'unsupported', 'other')),
  camera_issue_at  timestamptz,
  deletion_ack_at  timestamptz,
  ready_attempt    int,                           -- the attempt this person pressed "I'm ready" for
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (session_id, role)                       -- a third participant is impossible
);

-- ─── Rounds: one row per attempt (a retake starts a new attempt) ─────────────

create table photobooth_rounds (
  session_id   uuid not null references photobooth_sessions (id) on delete cascade,
  attempt      int not null,
  round        int not null check (round between 1 and 4),
  status       text not null default 'CAPTURING' check (status in ('CAPTURING', 'REVIEW', 'APPROVED', 'RETAKEN', 'ABORTED')),
  a_path       text,
  b_path       text,
  a_decision   text check (a_decision in ('KEEP', 'RETAKE')),
  b_decision   text check (b_decision in ('KEEP', 'RETAKE')),
  retake_by    text check (retake_by in ('A', 'B')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (session_id, attempt)
);
-- A round can only ever be approved once.
create unique index photobooth_rounds_one_approved on photobooth_rounds (session_id, round) where status = 'APPROVED';

create function photobooth_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger photobooth_sessions_touch before update on photobooth_sessions for each row execute function photobooth_touch();
create trigger photobooth_participants_touch before update on photobooth_participants for each row execute function photobooth_touch();
create trigger photobooth_rounds_touch before update on photobooth_rounds for each row execute function photobooth_touch();

alter table photobooth_sessions     enable row level security;
alter table photobooth_participants enable row level security;
alter table photobooth_rounds       enable row level security;

-- ─── Orders: one order belongs to exactly one product ────────────────────────

alter table orders alter column surprise_id drop not null;
alter table orders add column photobooth_session_id uuid references photobooth_sessions (id) on delete restrict;
alter table orders add constraint orders_one_product check (num_nonnulls(surprise_id, photobooth_session_id) = 1);
-- At most one open-or-paid order per photobooth: no double checkout / double charge.
create unique index orders_one_active_per_photobooth on orders (photobooth_session_id)
  where status in ('AWAITING_PAYMENT', 'PAID') and photobooth_session_id is not null;

-- ─── State transitions ───────────────────────────────────────────────────────
-- Each function locks the session, validates the transition, applies it and returns
-- what happened. Stale requests (old attempt) are rejected with ok = false.

-- Lobby updates while PAID; starts the session once both people are set.
create function pb_lobby(
  p_session uuid, p_role text,
  p_camera_ready boolean, p_camera_issue text, p_clear_issue boolean, p_ack boolean, p_frame text
) returns table (ok boolean, status text, started boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v photobooth_sessions; v_ready int;
begin
  select * into v from photobooth_sessions where id = p_session for update;
  if not found then return query select false, null::text, false; return; end if;

  update photobooth_participants set
    camera_ready_at = case when p_camera_ready then coalesce(camera_ready_at, now()) else camera_ready_at end,
    camera_issue    = case when p_camera_ready or p_clear_issue then null when p_camera_issue is not null then p_camera_issue else camera_issue end,
    camera_issue_at = case when p_camera_issue is not null and not p_camera_ready then now() when p_camera_ready or p_clear_issue then null else camera_issue_at end,
    deletion_ack_at = case when p_ack then coalesce(deletion_ack_at, now()) else deletion_ack_at end
  where session_id = p_session and role = p_role;

  if v.status <> 'PAID' then return query select true, v.status, false; return; end if;

  if p_frame is not null then
    update photobooth_sessions set frame_id = p_frame, last_activity_at = now() where id = p_session;
    v.frame_id := p_frame;
  else
    update photobooth_sessions set last_activity_at = now() where id = p_session;
  end if;

  select count(*) into v_ready from photobooth_participants
   where session_id = p_session and joined_at is not null and camera_ready_at is not null and deletion_ack_at is not null;

  if v_ready = 2 and v.frame_id is not null then
    update photobooth_sessions
       set status = 'IN_PROGRESS', current_round = 1, attempt = 1, round_phase = 'READY', capture_at = null
     where id = p_session;
    update photobooth_participants set ready_attempt = null where session_id = p_session;
    return query select true, 'IN_PROGRESS'::text, true;
    return;
  end if;
  return query select true, 'PAID'::text, false;
end $$;

-- "I'm ready" for the current attempt; when both are ready the shutter time is set.
create function pb_ready(p_session uuid, p_role text, p_attempt int, p_lead_ms int)
returns table (ok boolean, phase text, capture_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v photobooth_sessions; v_both int;
begin
  select * into v from photobooth_sessions where id = p_session for update;
  if not found or v.status <> 'IN_PROGRESS' or v.attempt <> p_attempt then
    return query select false, v.round_phase, v.capture_at; return;
  end if;
  if v.round_phase <> 'READY' then return query select true, v.round_phase, v.capture_at; return; end if;

  update photobooth_participants set ready_attempt = p_attempt where session_id = p_session and role = p_role;
  update photobooth_sessions set last_activity_at = now() where id = p_session;
  select count(*) into v_both from photobooth_participants where session_id = p_session and ready_attempt = p_attempt;

  if v_both = 2 then
    insert into photobooth_rounds (session_id, attempt, round) values (p_session, p_attempt, v.current_round)
      on conflict do nothing;
    update photobooth_sessions
       set round_phase = 'COUNTDOWN', capture_at = now() + make_interval(secs => p_lead_ms / 1000.0)
     where id = p_session
     returning round_phase, capture_at into v.round_phase, v.capture_at;
  end if;
  return query select true, v.round_phase, v.capture_at;
end $$;

-- A captured photo was stored. When both are in, the round goes to review.
create function pb_shot(p_session uuid, p_role text, p_attempt int, p_path text)
returns table (ok boolean, phase text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v photobooth_sessions; r photobooth_rounds;
begin
  select * into v from photobooth_sessions where id = p_session for update;
  if not found or v.status <> 'IN_PROGRESS' or v.attempt <> p_attempt or v.round_phase <> 'COUNTDOWN' then
    return query select false, v.round_phase; return;
  end if;
  update photobooth_rounds
     set a_path = case when p_role = 'A' then p_path else a_path end,
         b_path = case when p_role = 'B' then p_path else b_path end
   where session_id = p_session and attempt = p_attempt
   returning * into r;
  update photobooth_sessions set last_activity_at = now() where id = p_session;
  if r.a_path is not null and r.b_path is not null then
    update photobooth_rounds set status = 'REVIEW' where session_id = p_session and attempt = p_attempt;
    update photobooth_sessions set round_phase = 'REVIEW' where id = p_session;
    return query select true, 'REVIEW'::text; return;
  end if;
  return query select true, 'COUNTDOWN'::text;
end $$;

-- Keep / Retake. Both must keep; one retake sends BOTH back to the camera.
-- action: WAITING | RETAKE | APPROVED | COMPLETE (all 4 approved → GENERATING)
create function pb_decide(p_session uuid, p_role text, p_attempt int, p_decision text)
returns table (ok boolean, action text, delete_a text, delete_b text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v photobooth_sessions; r photobooth_rounds;
begin
  select * into v from photobooth_sessions where id = p_session for update;
  if not found or v.status <> 'IN_PROGRESS' or v.attempt <> p_attempt or v.round_phase <> 'REVIEW' then
    return query select false, null::text, null::text, null::text; return;
  end if;
  update photobooth_rounds
     set a_decision = case when p_role = 'A' then p_decision else a_decision end,
         b_decision = case when p_role = 'B' then p_decision else b_decision end
   where session_id = p_session and attempt = p_attempt
   returning * into r;
  update photobooth_sessions set last_activity_at = now() where id = p_session;

  if r.a_decision = 'RETAKE' or r.b_decision = 'RETAKE' then
    update photobooth_rounds set status = 'RETAKEN', retake_by = p_role where session_id = p_session and attempt = p_attempt;
    update photobooth_sessions set attempt = attempt + 1, round_phase = 'READY', capture_at = null where id = p_session;
    return query select true, 'RETAKE'::text, r.a_path, r.b_path; return;
  end if;

  if r.a_decision = 'KEEP' and r.b_decision = 'KEEP' then
    update photobooth_rounds set status = 'APPROVED' where session_id = p_session and attempt = p_attempt;
    if v.current_round >= 4 then
      update photobooth_sessions
         set status = 'GENERATING', round_phase = null, capture_at = null, generation_claimed_at = null
       where id = p_session;
      return query select true, 'COMPLETE'::text, null::text, null::text; return;
    end if;
    update photobooth_sessions
       set current_round = current_round + 1, attempt = attempt + 1, round_phase = 'READY', capture_at = null
     where id = p_session;
    return query select true, 'APPROVED'::text, null::text, null::text; return;
  end if;
  return query select true, 'WAITING'::text, null::text, null::text;
end $$;

-- A countdown nobody finished (someone's camera or upload never arrived): start the
-- attempt again instead of getting stuck. Safe to call any number of times.
create function pb_abort_stale(p_session uuid, p_grace_seconds int)
returns table (aborted boolean, delete_a text, delete_b text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v photobooth_sessions; r photobooth_rounds;
begin
  select * into v from photobooth_sessions where id = p_session for update;
  if not found or v.status <> 'IN_PROGRESS' or v.round_phase <> 'COUNTDOWN'
     or v.capture_at > now() - make_interval(secs => p_grace_seconds) then
    return query select false, null::text, null::text; return;
  end if;
  update photobooth_rounds set status = 'ABORTED' where session_id = p_session and attempt = v.attempt returning * into r;
  update photobooth_sessions set attempt = attempt + 1, round_phase = 'READY', capture_at = null where id = p_session;
  return query select true, r.a_path, r.b_path;
end $$;

-- Exactly one worker builds the strip at a time; a stale claim can be taken over.
create function pb_claim_generation(p_session uuid, p_stale_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update photobooth_sessions
     set generation_claimed_at = now(), generation_attempts = generation_attempts + 1
   where id = p_session and status = 'GENERATING'
     and (generation_claimed_at is null or generation_claimed_at < now() - make_interval(secs => p_stale_seconds));
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Strip stored → COMPLETED. The 7-day retention starts HERE.
create function pb_complete(p_session uuid, p_output_path text, p_retention_days int)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update photobooth_sessions
     set status = 'COMPLETED', output_path = p_output_path, completed_at = now(),
         expires_at = now() + make_interval(days => p_retention_days),
         generation_error = null, last_activity_at = now()
   where id = p_session and status = 'GENERATING';
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- Manual (launch) workflow: session + both participants + PAID order + payment in ONE
-- transaction. Replaying the same idempotency key returns the existing session.
create function create_manual_photobooth(
  p_a_hash text, p_a_enc text, p_b_hash text, p_b_enc text,
  p_order_number text, p_amount_centavos int, p_idempotency_key text,
  p_customer_label text, p_payment_channel text, p_payment_reference text, p_notes text, p_admin uuid
) returns table (session_id uuid, order_number text, replayed boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_session uuid; v_order uuid; v_number text;
begin
  select o.photobooth_session_id, o.order_number into v_session, v_number
    from orders o where o.idempotency_key = p_idempotency_key and o.payment_method = 'manual';
  if found then return query select v_session, v_number, true; return; end if;

  insert into photobooth_sessions (status, payment_status, price_centavos, paid_at)
    values ('PAID', 'PAID', p_amount_centavos, now()) returning id into v_session;
  insert into photobooth_participants (session_id, role, token_hash, token_enc) values
    (v_session, 'A', p_a_hash, p_a_enc), (v_session, 'B', p_b_hash, p_b_enc);
  insert into orders (order_number, photobooth_session_id, status, amount_centavos, currency, idempotency_key,
                      payment_method, customer_label, payment_reference, notes, created_by, paid_at)
    values (p_order_number, v_session, 'PAID', p_amount_centavos, 'PHP', p_idempotency_key,
            'manual', nullif(p_customer_label, ''), nullif(p_payment_reference, ''), nullif(p_notes, ''), p_admin, now())
    returning id into v_order;
  insert into payments (order_id, provider, provider_payment_id, amount_centavos, currency, method,
                        status, livemode, paid_at, confirmed_by)
    values (v_order, 'manual', 'manual:' || v_order, p_amount_centavos, 'PHP', p_payment_channel,
            'paid', true, now(), p_admin);
  return query select v_session, p_order_number, false;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'pb_lobby(uuid, text, boolean, text, boolean, boolean, text)',
    'pb_ready(uuid, text, int, int)',
    'pb_shot(uuid, text, int, text)',
    'pb_decide(uuid, text, int, text)',
    'pb_abort_stale(uuid, int)',
    'pb_claim_generation(uuid, int)',
    'pb_complete(uuid, text, int)',
    'create_manual_photobooth(text, text, text, text, text, int, text, text, text, text, text, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ─── Storage ─────────────────────────────────────────────────────────────────
-- Photobooth photos and strips are JPEG (best for downloading and sharing on phones), in
-- the same private bucket under photobooth/<session id>/. Still private: signed URLs only.
update storage.buckets
   set allowed_mime_types = array['image/webp', 'image/jpeg']
 where id = 'surprise-media';
