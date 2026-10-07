-- Love, Written — 60-day rule for unpublished paid surprises + abuse reports
-- Run AFTER 0001 and 0002. Safe to run once.

-- ─── Customer activity ───────────────────────────────────────────────────────
-- Updated only when the CUSTOMER opens or edits their surprise with their private
-- credential. Admin dashboard views never touch it.
alter table surprises add column last_customer_activity_at timestamptz not null default now();
update surprises set last_customer_activity_at = greatest(created_at, updated_at);

-- Finds paid surprises that were never published and have been idle for 60 days.
create index surprises_idle_paid_idx on surprises (last_customer_activity_at)
  where payment_status = 'PAID' and stage in ('DRAFT', 'CUSTOMIZING', 'READY_TO_PUBLISH');

alter table cleanup_jobs drop constraint cleanup_jobs_reason_check;
alter table cleanup_jobs add constraint cleanup_jobs_reason_check
  check (reason in ('expired', 'abandoned_draft', 'admin', 'unpublished_paid'));

-- ─── Content reports (recipients reporting abuse) ────────────────────────────
alter table reports
  add column kind   text not null default 'publish_failed' check (kind in ('publish_failed', 'content')),
  add column reason text check (char_length(reason) <= 40);
create index reports_kind_status_idx on reports (kind, status);
