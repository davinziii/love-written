-- Love, Written — Photobooth: three photos per strip
-- Run AFTER 0008. Safe to run once.
--
-- Each session records how many photos it takes. New sessions (and paid sessions that
-- haven't started their photos yet) take 3; sessions that already started or finished keep
-- the 4 they were made with, so their results still list every photo.

alter table photobooth_sessions
  add column if not exists photo_count int not null default 3 check (photo_count between 1 and 4);

update photobooth_sessions
   set photo_count = 4
 where status not in ('AWAITING_PAYMENT', 'PAID');

-- ─── Keep / Retake: the strip is complete after `photo_count` photos ─────────
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
    if v.current_round >= v.photo_count then
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

revoke execute on function pb_decide(uuid, text, int, text) from public, anon, authenticated;
grant execute on function pb_decide(uuid, text, int, text) to service_role;
