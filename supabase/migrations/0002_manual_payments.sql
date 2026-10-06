-- Love, Written — manual payments (launch workflow)
-- Run AFTER 0001_init.sql. Safe to run once.
--
-- Orders now record HOW they were paid. At launch the admin confirms payment manually
-- (GCash / Maya / bank transfer via DM) and creates the order; PayMongo stays available
-- and can be switched back on with NEXT_PUBLIC_PAYMENT_MODE=paymongo.

alter table orders
  add column payment_method    text not null default 'paymongo'
                               check (payment_method in ('manual', 'paymongo')),
  add column customer_label    text check (char_length(customer_label) <= 120),
  add column payment_reference text check (char_length(payment_reference) <= 120),
  add column notes             text check (char_length(notes) <= 1000),
  add column created_by        uuid references auth.users (id);

-- A manual order is created once per admin form submission.
create unique index orders_manual_idempotency on orders (idempotency_key) where payment_method = 'manual';

alter table payments
  add column provider     text not null default 'paymongo' check (provider in ('manual', 'paymongo')),
  add column confirmed_by uuid references auth.users (id),
  alter column checkout_session_id drop not null,
  alter column provider_event_id drop not null;

-- Creates surprise + PAID order + payment in ONE transaction.
-- Credentials are generated and hashed by the app; only hashes reach the database.
-- Replaying the same idempotency key returns the existing order. Credentials are rotated
-- on replay only while the customer hasn't started (stage DRAFT), so a late double-submit
-- can never lock a customer out of a surprise they are already working on.
create function create_manual_order(
  p_template_id        text,
  p_schema_version     int,
  p_edit_token_hash    text,
  p_recovery_code_hash text,
  p_order_number       text,
  p_amount_centavos    int,
  p_idempotency_key    text,
  p_customer_label     text,
  p_payment_channel    text,
  p_payment_reference  text,
  p_notes              text,
  p_admin              uuid
) returns table (surprise_id uuid, order_id uuid, order_number text, replayed boolean, credentials_issued boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_surprise uuid;
  v_order    uuid;
  v_number   text;
  v_stage    surprise_stage;
begin
  select o.surprise_id, o.id, o.order_number into v_surprise, v_order, v_number
    from orders o
   where o.idempotency_key = p_idempotency_key and o.payment_method = 'manual';

  if found then
    select stage into v_stage from surprises where id = v_surprise;
    if v_stage = 'DRAFT' then
      update surprises
         set edit_token_hash = p_edit_token_hash, recovery_code_hash = p_recovery_code_hash
       where id = v_surprise;
      return query select v_surprise, v_order, v_number, true, true;
    else
      return query select v_surprise, v_order, v_number, true, false;
    end if;
    return;
  end if;

  insert into surprises (template_id, schema_version, edit_token_hash, recovery_code_hash, payment_status)
  values (p_template_id, p_schema_version, p_edit_token_hash, p_recovery_code_hash, 'PAID')
  returning id into v_surprise;

  insert into orders (order_number, surprise_id, status, amount_centavos, currency, idempotency_key,
                      payment_method, customer_label, payment_reference, notes, created_by, paid_at)
  values (p_order_number, v_surprise, 'PAID', p_amount_centavos, 'PHP', p_idempotency_key,
          'manual', nullif(p_customer_label, ''), nullif(p_payment_reference, ''), nullif(p_notes, ''), p_admin, now())
  returning id into v_order;

  insert into payments (order_id, provider, provider_payment_id, amount_centavos, currency, method,
                        status, livemode, paid_at, confirmed_by)
  values (v_order, 'manual', 'manual:' || v_order, p_amount_centavos, 'PHP', p_payment_channel,
          'paid', true, now(), p_admin);

  return query select v_surprise, v_order, p_order_number, false, true;
end $$;

revoke execute on function create_manual_order(text, int, text, text, text, int, text, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function create_manual_order(text, int, text, text, text, int, text, text, text, text, text, uuid)
  to service_role;
