-- Love, Written — Photobooth: names, chat, and choosing the look after the photos
-- Run AFTER 0006. Safe to run once.

-- ─── Names (what each person is called on the other's screen) ────────────────
alter table photobooth_participants
  add column if not exists display_name text check (char_length(display_name) between 1 and 30),
  -- After the 4 photos each person picks a look; the strip is made when both pick the same.
  add column if not exists pick_frame text check (char_length(pick_frame) <= 64),
  add column if not exists pick_filter text check (pick_filter in ('bw', 'color')),
  add column if not exists pick_confirmed_at timestamptz;

-- ─── New step: DESIGNING (all 4 photos approved → choose filter + frame) ─────
alter table photobooth_sessions drop constraint if exists photobooth_sessions_status_check;
alter table photobooth_sessions add constraint photobooth_sessions_status_check check (status in (
  'AWAITING_PAYMENT', 'PAID', 'IN_PROGRESS', 'DESIGNING', 'GENERATING', 'FINALIZATION_FAILED',
  'COMPLETED', 'EXPIRED', 'CLEANUP_FAILED', 'DELETED'));
alter table photobooth_sessions
  add column if not exists final_filter text check (final_filter in ('bw', 'color'));

-- ─── Chat between the two people ─────────────────────────────────────────────
create table if not exists photobooth_messages (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references photobooth_sessions (id) on delete cascade,
  role        text not null check (role in ('A', 'B')),
  body        text not null check (char_length(body) between 1 and 300),
  client_id   uuid not null,                       -- makes a retried send idempotent
  created_at  timestamptz not null default now(),
  unique (session_id, client_id)
);
create index if not exists photobooth_messages_session_idx on photobooth_messages (session_id, id desc);
alter table photobooth_messages enable row level security;

-- ─── Round 4 approved → DESIGNING (instead of straight to GENERATING) ────────
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

  if r.a_decision = 'KEEP' and r.b_decision = 'KEEP' then
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

-- Pick a look (and optionally confirm it). Changing your pick un-confirms it. When both
-- people have confirmed the SAME look, the strip is made with it.
create function pb_pick(p_session uuid, p_role text, p_frame text, p_filter text, p_confirm boolean)
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

revoke execute on function pb_pick(uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function pb_pick(uuid, text, text, text, boolean) to service_role;
revoke execute on function pb_decide(uuid, text, int, text) from public, anon, authenticated;
grant execute on function pb_decide(uuid, text, int, text) to service_role;
