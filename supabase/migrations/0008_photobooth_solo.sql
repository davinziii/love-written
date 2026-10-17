-- Love, Written — Photobooth: solo (one-person) sessions
-- Run AFTER 0007. Safe to run once.
--
-- A session now has a party size: 2 (Person A + invited Person B, as before) or 1 (Person A
-- alone — no invite, no chat, no live partner view). Every "both people" rule in the state
-- functions becomes "everyone in this session". Existing sessions keep party_size = 2.

alter table photobooth_sessions
  add column if not exists party_size int not null default 2 check (party_size in (1, 2));

-- ─── Lobby: start once everyone in the session is set ────────────────────────
create or replace function pb_lobby(
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

  if v_ready = v.party_size and v.frame_id is not null then
    update photobooth_sessions
       set status = 'IN_PROGRESS', current_round = 1, attempt = 1, round_phase = 'READY', capture_at = null
     where id = p_session;
    update photobooth_participants set ready_attempt = null where session_id = p_session;
    return query select true, 'IN_PROGRESS'::text, true;
    return;
  end if;
  return query select true, 'PAID'::text, false;
end $$;

-- ─── "I'm ready": the shutter time is set once everyone is ready ─────────────
create or replace function pb_ready(p_session uuid, p_role text, p_attempt int, p_lead_ms int)
returns table (ok boolean, phase text, capture_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v photobooth_sessions; v_ready int;
begin
  select * into v from photobooth_sessions where id = p_session for update;
  if not found or v.status <> 'IN_PROGRESS' or v.attempt <> p_attempt then
    return query select false, v.round_phase, v.capture_at; return;
  end if;
  if v.round_phase <> 'READY' then return query select true, v.round_phase, v.capture_at; return; end if;

  update photobooth_participants set ready_attempt = p_attempt where session_id = p_session and role = p_role;
  update photobooth_sessions set last_activity_at = now() where id = p_session;
  select count(*) into v_ready from photobooth_participants where session_id = p_session and ready_attempt = p_attempt;

  if v_ready = v.party_size then
    insert into photobooth_rounds (session_id, attempt, round) values (p_session, p_attempt, v.current_round)
      on conflict do nothing;
    update photobooth_sessions
       set round_phase = 'COUNTDOWN', capture_at = now() + make_interval(secs => p_lead_ms / 1000.0)
     where id = p_session
     returning round_phase, capture_at into v.round_phase, v.capture_at;
  end if;
  return query select true, v.round_phase, v.capture_at;
end $$;

-- ─── A photo was stored: review once everyone's photo is in ──────────────────
create or replace function pb_shot(p_session uuid, p_role text, p_attempt int, p_path text)
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
  if r.a_path is not null and (v.party_size = 1 or r.b_path is not null) then
    update photobooth_rounds set status = 'REVIEW' where session_id = p_session and attempt = p_attempt;
    update photobooth_sessions set round_phase = 'REVIEW' where id = p_session;
    return query select true, 'REVIEW'::text; return;
  end if;
  return query select true, 'COUNTDOWN'::text;
end $$;

-- ─── Keep / Retake: everyone must keep; one retake sends everyone back ───────
create or replace function pb_decide(p_session uuid, p_role text, p_attempt int, p_decision text)
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

  if r.a_decision = 'KEEP' and (v.party_size = 1 or r.b_decision = 'KEEP') then
    update photobooth_rounds set status = 'APPROVED' where session_id = p_session and attempt = p_attempt;
    if v.current_round >= 4 then
      update photobooth_sessions
         set status = 'DESIGNING', round_phase = null, capture_at = null
       where id = p_session;
      update photobooth_participants set pick_confirmed_at = null where session_id = p_session;
      return query select true, 'COMPLETE'::text, null::text, null::text; return;
    end if;
    update photobooth_sessions
       set current_round = current_round + 1, attempt = attempt + 1, round_phase = 'READY', capture_at = null
     where id = p_session;
    return query select true, 'APPROVED'::text, null::text, null::text; return;
  end if;
  return query select true, 'WAITING'::text, null::text, null::text;
end $$;

-- ─── Choose the look: solo needs only Person A's confirmation ────────────────
create or replace function pb_pick(p_session uuid, p_role text, p_frame text, p_filter text, p_confirm boolean)
returns table (ok boolean, started boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v photobooth_sessions; a photobooth_participants; b photobooth_participants;
begin
  select * into v from photobooth_sessions where id = p_session for update;
  if not found or v.status <> 'DESIGNING' then return query select false, false; return; end if;

  update photobooth_participants set
    pick_confirmed_at = case
      when p_confirm then now()
      when (p_frame is not null and p_frame is distinct from pick_frame)
        or (p_filter is not null and p_filter is distinct from pick_filter) then null
      else pick_confirmed_at end,
    pick_frame  = coalesce(p_frame, pick_frame),
    pick_filter = coalesce(p_filter, pick_filter)
  where session_id = p_session and role = p_role;
  update photobooth_sessions set last_activity_at = now() where id = p_session;

  select * into a from photobooth_participants where session_id = p_session and role = 'A';
  if v.party_size = 1 then
    if a.pick_confirmed_at is not null and a.pick_frame is not null and a.pick_filter is not null then
      update photobooth_sessions
         set status = 'GENERATING', frame_id = a.pick_frame, final_filter = a.pick_filter, generation_claimed_at = null
       where id = p_session;
      return query select true, true; return;
    end if;
    return query select true, false; return;
  end if;

  select * into b from photobooth_participants where session_id = p_session and role = 'B';
  if a.pick_confirmed_at is not null and b.pick_confirmed_at is not null
     and a.pick_frame = b.pick_frame and a.pick_filter = b.pick_filter then
    update photobooth_sessions
       set status = 'GENERATING', frame_id = a.pick_frame, final_filter = a.pick_filter, generation_claimed_at = null
     where id = p_session;
    return query select true, true; return;
  end if;
  return query select true, false;
end $$;

-- ─── Manual (admin) creation: one or two people ──────────────────────────────
drop function if exists create_manual_photobooth(text, text, text, text, text, int, text, text, text, text, text, uuid);
create function create_manual_photobooth(
  p_a_hash text, p_a_enc text, p_b_hash text, p_b_enc text,
  p_order_number text, p_amount_centavos int, p_idempotency_key text,
  p_customer_label text, p_payment_channel text, p_payment_reference text, p_notes text, p_admin uuid,
  p_party_size int
) returns table (session_id uuid, order_number text, replayed boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare v_session uuid; v_order uuid; v_number text;
begin
  if p_party_size not in (1, 2) then raise exception 'party size must be 1 or 2'; end if;
  select o.photobooth_session_id, o.order_number into v_session, v_number
    from orders o where o.idempotency_key = p_idempotency_key and o.payment_method = 'manual';
  if found then return query select v_session, v_number, true; return; end if;

  insert into photobooth_sessions (status, payment_status, price_centavos, paid_at, party_size)
    values ('PAID', 'PAID', p_amount_centavos, now(), p_party_size) returning id into v_session;
  insert into photobooth_participants (session_id, role, token_hash, token_enc) values (v_session, 'A', p_a_hash, p_a_enc);
  if p_party_size = 2 then
    insert into photobooth_participants (session_id, role, token_hash, token_enc) values (v_session, 'B', p_b_hash, p_b_enc);
  end if;
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
    'pb_pick(uuid, text, text, text, boolean)',
    'create_manual_photobooth(text, text, text, text, text, int, text, text, text, text, text, uuid, int)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
