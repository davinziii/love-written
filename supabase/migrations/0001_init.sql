-- Love, Written — initial schema
-- All customer access goes through server route handlers using the service role.
-- RLS is enabled on every table with NO anon/authenticated policies, so the public
-- anon key cannot read or write anything directly.

create extension if not exists pgcrypto;

-- ─── Enums ───────────────────────────────────────────────────────────────────

create type surprise_stage as enum (
  'DRAFT',             -- created, nothing entered yet
  'CUSTOMIZING',       -- customer has started editing
  'READY_TO_PUBLISH',  -- payment confirmed by webhook
  'SCHEDULED',         -- link issued, reveal in the future, still editable
  'PUBLISHED',         -- live and locked
  'PUBLISH_FAILED',    -- paid, but a publish/activation attempt failed
  'EXPIRED',           -- 30 days elapsed, awaiting cleanup
  'CLEANUP_FAILED',    -- deletion failed after automatic retries
  'DELETED',           -- media + content deleted and verified
  'DISABLED'           -- taken down by an admin
);

create type payment_status as enum ('UNPAID', 'AWAITING_PAYMENT', 'PAID', 'PAYMENT_FAILED');
create type order_status as enum ('AWAITING_PAYMENT', 'PAID', 'PAYMENT_FAILED', 'EXPIRED');
create type operation_status as enum ('RUNNING', 'SUCCEEDED', 'FAILED');
create type cleanup_status as enum ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');
create type report_status as enum ('OPEN', 'RESOLVED');

-- ─── Surprises ───────────────────────────────────────────────────────────────

create table surprises (
  id                  uuid primary key default gen_random_uuid(),
  template_id         text not null,
  schema_version      int  not null,
  stage               surprise_stage not null default 'DRAFT',
  payment_status      payment_status not null default 'UNPAID',

  -- customer data, kept separate from the template definition
  content             jsonb not null default '{}'::jsonb,   -- names, messages, dates, media ids
  style               jsonb not null default '{}'::jsonb,   -- theme, font, music ids

  -- credentials (only hashes are stored)
  edit_token_hash     text not null,
  recovery_code_hash  text not null unique,
  public_token        text unique,                          -- issued at first publish/schedule

  -- reveal timing
  reveal_mode         text not null default 'now' check (reveal_mode in ('now', 'schedule')),
  scheduled_for       timestamptz,

  -- lifecycle timestamps
  locked_at           timestamptz,
  published_at        timestamptz,
  expires_at          timestamptz,
  draft_expires_at    timestamptz not null default (now() + interval '14 days'),
  disabled_at         timestamptz,
  disabled_reason     text,
  deleted_at          timestamptz,

  -- recipient engagement (no per-viewer data)
  first_opened_at     timestamptz,
  open_count          int not null default 0,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index surprises_stage_idx on surprises (stage);
create index surprises_scheduled_idx on surprises (scheduled_for) where stage = 'SCHEDULED';
create index surprises_expires_idx on surprises (expires_at) where stage = 'PUBLISHED';
create index surprises_draft_expiry_idx on surprises (draft_expires_at)
  where stage in ('DRAFT', 'CUSTOMIZING') and payment_status <> 'PAID';

-- Content is immutable once locked (published). The only permitted change afterwards is
-- the cleanup job wiping it while moving to DELETED.
create function surprises_guard() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if old.locked_at is not null then
    if new.locked_at is null then
      raise exception 'surprise % cannot be unlocked', old.id;
    end if;
    if new.stage <> 'DELETED' and (
         new.content is distinct from old.content
      or new.style is distinct from old.style
      or new.template_id is distinct from old.template_id
      or new.public_token is distinct from old.public_token) then
      raise exception 'surprise % is published and immutable', old.id;
    end if;
  end if;
  if old.public_token is not null and new.public_token is distinct from old.public_token then
    raise exception 'public token of surprise % cannot change', old.id;
  end if;
  return new;
end $$;

create trigger surprises_guard before update on surprises
  for each row execute function surprises_guard();

-- ─── Media ───────────────────────────────────────────────────────────────────

create table media (
  id            uuid primary key default gen_random_uuid(),
  surprise_id   uuid not null references surprises (id) on delete cascade,
  field_id      text not null,
  storage_path  text not null unique,
  bytes         int  not null,
  width         int  not null,
  height        int  not null,
  created_at    timestamptz not null default now(),
  unique (surprise_id, field_id)
);

-- Photos of a published surprise are immutable too. Deleting is allowed only once the
-- surprise has left PUBLISHED (expired / disabled) so the cleanup job can remove them.
create function media_guard() returns trigger language plpgsql as $$
declare v_locked timestamptz; v_stage surprise_stage;
begin
  select locked_at, stage into v_locked, v_stage
    from surprises where id = coalesce(new.surprise_id, old.surprise_id);
  if v_locked is not null and (tg_op <> 'DELETE' or v_stage = 'PUBLISHED') then
    raise exception 'media of published surprise % is immutable', coalesce(new.surprise_id, old.surprise_id);
  end if;
  return coalesce(new, old);
end $$;

create trigger media_guard before insert or update or delete on media
  for each row execute function media_guard();

-- ─── Orders & payments ───────────────────────────────────────────────────────

create table orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text not null unique,
  surprise_id           uuid not null references surprises (id) on delete restrict,
  status                order_status not null default 'AWAITING_PAYMENT',
  amount_centavos       int not null check (amount_centavos > 0),
  currency              text not null default 'PHP',
  idempotency_key       text not null,
  provider              text not null default 'paymongo',
  checkout_session_id   text unique,
  checkout_url          text,
  payment_intent_id     text unique,
  paid_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (surprise_id, idempotency_key)
);

-- At most one open-or-paid order per surprise: prevents double checkout / double charge.
create unique index orders_one_active_per_surprise on orders (surprise_id)
  where status in ('AWAITING_PAYMENT', 'PAID');

create table payments (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders (id) on delete restrict,
  provider_payment_id   text not null unique,
  checkout_session_id   text not null,
  amount_centavos       int not null,
  currency              text not null,
  method                text,
  status                text not null,
  livemode              boolean not null,
  provider_event_id     text not null,
  paid_at               timestamptz,
  created_at            timestamptz not null default now()
);
create index payments_order_idx on payments (order_id);

-- Webhook inbox. The unique provider event id makes processing idempotent.
create table payment_events (
  id                  uuid primary key default gen_random_uuid(),
  provider_event_id   text not null unique,
  type                text not null,
  livemode            boolean not null,
  resource_id         text,
  payload             jsonb not null,
  processed_at        timestamptz,
  error               text,
  received_at         timestamptz not null default now()
);

-- ─── Publishing ──────────────────────────────────────────────────────────────

create table publish_operations (
  id                uuid primary key default gen_random_uuid(),
  surprise_id       uuid not null references surprises (id) on delete cascade,
  idempotency_key   text not null,
  mode              text not null check (mode in ('now', 'schedule', 'activate')),
  source            text not null check (source in ('customer', 'admin', 'scheduler')),
  scheduled_for     timestamptz,
  status            operation_status not null default 'RUNNING',
  error_code        text,
  error_message     text,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  unique (surprise_id, idempotency_key)
);
-- Only one in-flight publish operation per surprise.
create unique index publish_ops_one_running on publish_operations (surprise_id)
  where status = 'RUNNING';
create index publish_ops_failed_idx on publish_operations (status, started_at desc);

-- ─── Reports ─────────────────────────────────────────────────────────────────

create table reports (
  id                     uuid primary key default gen_random_uuid(),
  report_code            text not null unique,
  surprise_id            uuid not null references surprises (id) on delete cascade,
  order_id               uuid references orders (id),
  payment_id             uuid references payments (id),
  provider_reference     text,
  publish_operation_id   uuid unique references publish_operations (id),
  idempotency_key        text not null,
  error_code             text,
  error_message          text,
  customer_message       text check (char_length(customer_message) <= 1000),
  status                 report_status not null default 'OPEN',
  created_at             timestamptz not null default now(),
  resolved_at            timestamptz,
  unique (surprise_id, idempotency_key)
);

-- ─── Cleanup ─────────────────────────────────────────────────────────────────

create table cleanup_jobs (
  id               uuid primary key default gen_random_uuid(),
  surprise_id      uuid not null unique references surprises (id) on delete cascade,
  reason           text not null check (reason in ('expired', 'abandoned_draft', 'admin')),
  status           cleanup_status not null default 'PENDING',
  attempts         int not null default 0,
  last_attempt_at  timestamptz,
  next_retry_at    timestamptz not null default now(),
  last_error       text,
  failed_items     jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  finished_at      timestamptz
);
create index cleanup_jobs_due_idx on cleanup_jobs (next_retry_at) where status in ('PENDING', 'FAILED');

-- ─── Rate limiting ───────────────────────────────────────────────────────────

create table rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (key, window_start)
);

-- Fixed-window counter. Returns true when the call is allowed.
create function rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into rate_limits (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_max;
end $$;

-- ─── Recipient opens ─────────────────────────────────────────────────────────

create function record_surprise_open(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_first boolean;
begin
  update surprises
     set open_count = open_count + 1,
         first_opened_at = coalesce(first_opened_at, now())
   where id = p_id
  returning (open_count = 1) into v_first;
  return coalesce(v_first, false);
end $$;

-- ─── Analytics ───────────────────────────────────────────────────────────────

create table analytics_events (
  id           bigint generated always as identity primary key,
  name         text not null,
  template_id  text,
  surprise_id  uuid,
  created_at   timestamptz not null default now()
);
create index analytics_events_name_time on analytics_events (name, created_at);

-- ─── Admins ──────────────────────────────────────────────────────────────────

create table admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table surprises          enable row level security;
alter table media              enable row level security;
alter table orders             enable row level security;
alter table payments           enable row level security;
alter table payment_events     enable row level security;
alter table publish_operations enable row level security;
alter table reports            enable row level security;
alter table cleanup_jobs       enable row level security;
alter table rate_limits        enable row level security;
alter table analytics_events   enable row level security;
alter table admin_users        enable row level security;
-- No policies are created: anon and authenticated roles have no access.
-- The server uses the service role, which bypasses RLS.

revoke execute on function rate_limit_hit(text, int, int) from public, anon, authenticated;
revoke execute on function record_surprise_open(uuid) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, int, int) to service_role;
grant execute on function record_surprise_open(uuid) to service_role;

-- ─── Storage ─────────────────────────────────────────────────────────────────

-- Private bucket: objects are only reachable via server-issued signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('surprise-media', 'surprise-media', false, 4194304, array['image/webp'])
on conflict (id) do nothing;
