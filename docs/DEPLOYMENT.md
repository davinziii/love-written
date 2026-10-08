# Deployment

One Next.js app on Vercel. Every surprise is served by the same deployment at
`/s/<token>` — there are never per-customer deployments.

```text
Cloudflare (DNS, proxy, WAF, Turnstile)
        │
        ▼
Vercel — Next.js app (pages, API routes, cron)
        │                    │
        ▼                    ▼
Supabase                PayMongo
(Postgres, Storage,     (Checkout Sessions,
 Auth for admin)         webhooks)
```

## 1. Supabase

1. Create a project (region close to the Philippines, e.g. Singapore).
2. **SQL Editor** → run `supabase/migrations/0001_init.sql`. It creates the tables, enables
   RLS on every table (with no public policies), the private `surprise-media` bucket,
   the immutability triggers and helper functions.
   Then run `supabase/migrations/0002_manual_payments.sql` (manual payment workflow) and
   `supabase/migrations/0003_activity_and_content_reports.sql` (60-day rule + abuse reports).
   Then `0004_admin_access_copy.sql` (admin copy of private links) and
   `0005_photobooth.sql` (Photobooth — see docs/PHOTOBOOTH.md).
3. **Settings → API**: copy the URL, `anon` key and `service_role` key into Vercel env vars.
   The service role key is server-only — never prefix it with `NEXT_PUBLIC_`.
4. **Create the admin:**
   - **Authentication → Users → Add user** (email + strong password, auto-confirm).
   - **Authentication → Providers → Email**: turn **off** "Allow new users to sign up" so
     nobody else can create accounts.
   - SQL Editor:
     ```sql
     insert into admin_users (user_id)
     select id from auth.users where email = 'you@example.com';
     ```
   Signing in at `/admin/login` requires **both** a valid Supabase Auth session **and** a row
   in `admin_users`.
5. Backups: Supabase's built-in daily backups cover the database. Customer photos are in
   Storage, which is not part of those backups, so deleted photos do not linger in backups.
   Database backups may contain surprise text for up to the provider's backup retention window
   after deletion — mention this in your privacy policy.

## 1b. Manual payments (launch workflow)

1. Keep `NEXT_PUBLIC_PAYMENT_MODE=manual`.
2. Set `NEXT_PUBLIC_ORDER_URL` to where customers message you (e.g. `https://ig.me/m/your_handle`
   or `https://m.me/your_page`) and `NEXT_PUBLIC_ORDER_LABEL` to the button text.
3. When someone pays: **/admin → Create Surprise**, pick the template, enter the amount and
   reference, tick "payment received", and copy the ready-made message into their DM.
4. Lost link? Open the surprise in the admin and click **New customer link**.

The PayMongo section below is only needed when you switch to `NEXT_PUBLIC_PAYMENT_MODE=paymongo`.

## 2. PayMongo

1. Activate the payment methods you want (GCash, Maya, QR Ph, cards) on your account.
2. **Developers → API keys**: put the secret key in `PAYMONGO_SECRET_KEY` (server only).
3. Create a webhook (Dashboard or API) pointing to
   `https://<your-domain>/api/webhooks/paymongo` with events:
   - `checkout_session.payment.paid`
   - `payment.paid`
   - `payment.failed`
4. Put the webhook's signing secret in `PAYMONGO_WEBHOOK_SECRET`.
5. `PAYMONGO_MODE=test` while testing (verifies the `te` signature), `live` in production
   (verifies `li`). Test and live webhooks have different secrets.
6. `PAYMONGO_PAYMENT_METHODS` must list only methods active on your account
   (`gcash,paymaya,qrph,card`).

The browser's return from PayMongo is never trusted. Only a signature-verified webhook marks
an order PAID; the studio polls our own server until that happens.

## 3. Vercel

1. Import the repository. Framework: Next.js. No special build settings.
2. Add every variable from `.env.example` (Production and Preview). Generate secrets with:
   ```bash
   openssl rand -base64 48
   ```
3. `NEXT_PUBLIC_SITE_URL` must be your real domain (used for PayMongo return URLs and share links).
4. **Cron**: `vercel.json` schedules `/api/cron/maintenance` daily at 00:00 Manila time.
   Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

### More frequent maintenance (recommended, free)

Vercel Hobby crons run once a day. That is *correct* but slow for retries, because:

- scheduled surprises are also activated the moment a recipient opens the link, and
- expired surprises are blocked at read time,

…so the cron mainly handles deletion and retries. To run it every 10 minutes for free,
use Supabase `pg_cron` + `pg_net` (Database → Extensions → enable both), then:

```sql
select cron.schedule(
  'love-written-maintenance',
  '*/10 * * * *',
  $$ select net.http_get(
       url := 'https://<your-domain>/api/cron/maintenance',
       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
     ); $$
);
```

## 3b. Email alerts (Resend, free)

You get an email when a paid surprise fails to publish, a customer or recipient files a report,
a deletion needs a retry, a payment webhook fails, or the site hits a server error.

1. Sign up at **resend.com** using **lovewritten.business@gmail.com** (the alert address).
   Without your own domain, Resend only delivers to the address you signed up with.
2. Resend → **API Keys** → create a key → add it on Vercel as `RESEND_API_KEY`.
3. Optional: `ALERT_EMAIL` (defaults to lovewritten.business@gmail.com) and `ALERT_FROM`.
4. Redeploy. Alerts are limited to a few per type per hour so the inbox never floods.
   They never contain customer messages, photos or links.

## 4. Cloudflare

See [CLOUDFLARE.md](CLOUDFLARE.md).

## 5. Go-live checklist

- [ ] Migration applied; `select count(*) from pg_policies where schemaname = 'public'` returns 0
- [ ] `surprise-media` bucket is **private**
- [ ] Admin user exists, sign-ups disabled, row in `admin_users`
- [ ] `PAYMONGO_MODE=live` with the live webhook secret
- [ ] One real ₱199 purchase end-to-end in live mode, published and opened on a phone
- [ ] `LW_FAULT_INJECT_PUBLISH` unset
- [ ] Turnstile keys set (optional but recommended)
- [ ] Cron responding: call `/api/cron/maintenance` with the bearer token and check the JSON summary
- [ ] Privacy policy & terms pages mention: 30-day hosting, deletion, no refunds, PayMongo

## Scaling notes

| Volume | What to watch | Upgrade path |
|---|---|---|
| ~100 customers/mo | Storage ≈ 3 photos × ~400 KB × live surprises — tens of MB | Free tiers are fine |
| ~300+/mo | Supabase egress (photo views), DB connections | Supabase Pro |
| much more | Storage cost/egress | Swap `src/lib/media/storage.ts` to R2/S3 — nothing else changes |

The admin **Storage** page shows stored bytes, active surprises, uploads and failures.
