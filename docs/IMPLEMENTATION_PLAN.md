# Love, Written — Implementation Plan (V1)

Concise plan written before coding. Every product decision comes from the master prompt;
this file records the *technical* decisions made to implement it.

## 1. Folder structure

```text
src/
  app/
    page.tsx                         Landing
    surprises/page.tsx               Pick a Surprise (template catalog)
    surprises/[templateId]/page.tsx  Template tab (large preview + details)
    studio/[surpriseId]/...          Customer flow: editor → preview/timing → payment → finalize
    recover/page.tsx                 Find My Surprise (recovery code)
    faq/page.tsx                     FAQ
    s/[token]/page.tsx               Published surprise (recipient)
    admin/...                        Admin dashboard (Supabase Auth + admin_users allowlist)
    api/...                          Route handlers (one responsibility each)
  components/                        UI building blocks (editor, preview, landing, admin)
  lib/
    env.ts                           Typed env access (server-only secrets separated)
    supabase/                        Service-role client (server-only) + SSR auth client (admin)
    security/                        Tokens, hashing, rate limiting, Turnstile, request helpers
    lifecycle/                       State machine + transition guards
    surprises/                       Repository + publish / schedule / activate logic
    payments/paymongo.ts             PayMongo API + webhook signature verification
    media/                           Image sniffing + server re-encoding (sharp) + storage
    cleanup/                         Expiration + deletion + verification + retries
    analytics/                       Allow-listed funnel events
  templates/
    types.ts                         Field types + defineTemplate() + type inference
    schema.ts                        Zod schema generated from a template definition
    styles.ts                        Curated themes, fonts, music library
    index.ts                         Template definition registry (server + client safe)
    renderers.tsx                    Renderer registry (template id → trusted React component)
    our-story/definition.ts          Our Story schema
    our-story/OurStoryRenderer.tsx   Our Story experience
supabase/migrations/0001_init.sql    Schema, RLS, triggers, RPCs
docs/                                Plan, deployment, Cloudflare, testing
TEMPLATE_DEVELOPMENT.md              How to add template #2
```

## 2. Database entities

| Table | Responsibility |
|---|---|
| `surprises` | Customer project: template id, content, style, lifecycle `stage`, separate `payment_status`, tokens (hashed), reveal timing, lock/publish/expiry timestamps |
| `media` | One optimized image per (surprise, image field); storage path + metadata |
| `orders` | One purchase attempt: order number, amount (server constant ₱199), PayMongo checkout session |
| `payments` | Verified PayMongo payments (unique provider payment id) |
| `payment_events` | Webhook inbox — unique provider event id ⇒ idempotent processing |
| `publish_operations` | Every publish/schedule/activation attempt (idempotency key, status, error) |
| `reports` | Customer "Report This Problem" — linked to order, payment, provider ref, operation |
| `cleanup_jobs` | Deletion lifecycle with attempts, backoff, failed items |
| `rate_limits` | Fixed-window counters used by `rate_limit_hit()` RPC |
| `analytics_events` | Lightweight funnel events (no PII) |
| `admin_users` | Allowlist of Supabase Auth users who are admins |

**Decision:** template *fields* live in trusted code (`src/templates/*/definition.ts`), not a
`template_fields` table. Fields must stay in lockstep with the typed renderer that consumes
them; keeping both in code means one deploy changes both and TypeScript checks the pairing.
Each surprise stores `template_id` + `schema_version`. The catalog flag (`listed`) is in code too.

## 3. Template + rendering architecture

```text
definition.ts (fields) ──► generic Zod schema ──► server validation (draft / strict)
        │
        └──► Generic editor (renders controls by field type, grouped by field.group)
                    │ customer data {content, style}
                    ▼
        resolveRenderData() — media ids → signed URLs, style ids kept
                    ▼
        renderers.tsx["our-story"] → OurStoryRenderer (layout, animation, interaction)
                    ▼
        Studio preview (watermark overlay)  |  /s/[token] (no watermark)
```

The renderer never decides payment, access, editing, expiry or storage.

## 4. API / server operations

| Operation | Route | Auth |
|---|---|---|
| Create draft | `POST /api/surprises` | Turnstile (optional) + IP rate limit |
| Load / save draft | `GET` / `PATCH /api/surprises/:id` | edit token |
| Upload / remove image | `POST` / `DELETE /api/surprises/:id/media` | edit token + rate limit |
| Create checkout | `POST /api/surprises/:id/checkout` | edit token + idempotency key |
| Poll status | `GET /api/surprises/:id/status` | edit token |
| Publish now / schedule | `POST /api/surprises/:id/publish` | edit token + idempotency key |
| Report failed publish | `POST /api/surprises/:id/reports` | edit token + idempotency key |
| Recover | `POST /api/recover` | recovery code + Turnstile + strict rate limit |
| PayMongo webhook | `POST /api/webhooks/paymongo` | HMAC signature |
| Maintenance (activate, expire, cleanup) | `GET /api/cron/maintenance` | `CRON_SECRET` bearer |
| Analytics | `POST /api/events` | allow-listed names + rate limit |
| Admin actions | Server actions under `/admin` | Supabase Auth session + `admin_users` |

## 5. Storage strategy

* Private bucket `surprise-media`; path `surprises/{surpriseId}/{randomUuid}.webp` (server-generated).
* Browser resizes to ≤2400px WebP (saves bandwidth); **server re-validates magic bytes, decodes and
  re-encodes with sharp** (strips EXIF/GPS, enforces dimensions). Only the optimized file is stored.
* Replacing a photo deletes the previous object immediately (no orphans).
* Media served only through short-lived signed URLs generated server-side.

## 6. Lifecycle state machine

`stage`: `DRAFT → CUSTOMIZING → READY_TO_PUBLISH → (SCHEDULED →) PUBLISHED → EXPIRED → DELETED`,
plus `PUBLISH_FAILED`, `CLEANUP_FAILED`, `DISABLED`.
`payment_status` (separate): `UNPAID → AWAITING_PAYMENT → PAID` or `PAYMENT_FAILED`.
Transitions are compare-and-set updates (`… where stage in (allowed)`), so concurrent requests
cannot both win. A DB trigger rejects any content change once `locked_at` is set.

* Publish Now: lock + `published_at = now`, `expires_at = +30d`.
* Schedule: get the link immediately, keep editing (strictly validated) until `scheduled_for`;
  activation locks and sets `published_at = scheduled_for`, `expires_at = +30d`.
* Activation happens **lazily on first view after the reveal time** and in the maintenance cron,
  so correctness does not depend on cron frequency (Vercel Hobby crons run daily).
* Expiry is also enforced at read time.

## 7. Payment flow

Checkout → server validates required fields → creates order (partial unique index: one open order
per surprise) → PayMongo Checkout Session (amount from server config, `metadata.order_id`) →
customer pays → **verified webhook** `checkout_session.payment.paid` (HMAC-SHA256 of
`t.rawBody`, compare `te`/`li` by livemode, amount/currency/order cross-checked) →
`payment_status = PAID`, `stage = READY_TO_PUBLISH`. The return page only polls our server.

## 8. Security model

* Public token: 32 random bytes base64url (256-bit), created at first publish/schedule.
* Edit token: 32 random bytes, stored as SHA-256 hash; sent in `x-lw-edit-token`.
* Recovery code: 12 chars Crockford base32 (60-bit), stored as HMAC-SHA256 with server pepper;
  redeeming it rotates the edit token. 12 instead of 8 chars: 8 chars (40 bits) is too guessable.
* RLS enabled on every table with no anon policies — the browser never talks to tables directly.
* `noindex,nofollow,noarchive` meta + `X-Robots-Tag`, `Referrer-Policy: no-referrer`,
  `Cache-Control: private, no-store` on `/s/*`; CSP and frame denial site-wide.
* Postgres-backed rate limiter (free, works on serverless), Turnstile optional, Cloudflare in front.
* Customer text rendered as React text only — no `dangerouslySetInnerHTML`.

## 9. Admin architecture

Supabase Auth (email + password) session via `@supabase/ssr`; every admin page and action calls
`requireAdmin()` which checks the session server-side **and** the `admin_users` allowlist.
The proxy only refreshes the session cookie; it is not the security boundary.
Admin actions are narrow server actions (retry publish, retry cleanup, disable, delete now,
resolve report) — no generic DB access.

## 10. Testing

Vitest unit tests for pure logic (schema validation, tokens, webhook signatures, lifecycle guards,
image sniffing). End-to-end scenarios requiring Supabase + PayMongo test mode are a checklist in
`docs/TESTING.md`, plus a dev-only fault-injection flag to exercise "paid but publish failed".
