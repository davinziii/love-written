# Love, Written

Personalized digital surprises. A customer picks a professionally designed interactive
template, adds their words and photos, previews it (watermarked), pays ₱99 through PayMongo,
and publishes it now or on a schedule. The recipient opens a private link. It stays online for
30 days after going live, then its photos and content are deleted and the deletion is verified.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Storage,
Auth for admin) · PayMongo · Vercel · Cloudflare

```text
Pick a Surprise → Make It Yours → Preview → Pay → Reveal
```

## Payment workflows

The app supports two payment workflows, chosen with `NEXT_PUBLIC_PAYMENT_MODE`:

| Mode | Flow | Status |
|---|---|---|
| `manual` (default) | Customer DMs you → pays by GCash/Maya/bank → you confirm in **/admin → Create Surprise** → they get a private customization link → customize → publish now or schedule | **Launch workflow** |
| `paymongo` | Customer customizes → watermarked preview → PayMongo Checkout → verified webhook → publish now or schedule | Ready for when PayMongo is activated |

Everything after "the order is paid" — editing, the publish lock, scheduling, the 30-day
lifetime, deletion, failed-publish recovery — is shared by both. Switching to PayMongo is a
configuration change, not a rewrite. The manual provider lives in `src/lib/payments/manual.ts`;
the PayMongo provider in `src/lib/payments/{checkout,paymongo,webhook}.ts`.

## Quick start

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local` (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)), run
`supabase/migrations/0001_init.sql` in your Supabase project, then:

```bash
npm run dev
```

The landing page, catalog and template pages work without any credentials; creating a
surprise needs Supabase, and paying needs PayMongo test keys.

## Documentation

| Doc | What's in it |
|---|---|
| [TEMPLATE_DEVELOPMENT.md](TEMPLATE_DEVELOPMENT.md) | **How templates work and how to add Template #2** |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Architecture decisions, entities, state machine, security model |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Supabase, PayMongo, Vercel, admin user, cron, go-live checklist |
| [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md) | DNS, WAF rules that keep webhooks working, rate limiting, Turnstile |
| [docs/TESTING.md](docs/TESTING.md) | Automated tests and the manual end-to-end checklist |

## Project map

```text
src/
  templates/                 ← templates live here (trusted code)
    types.ts                   field types, defineTemplate(), TemplateData<…> inference
    schema.ts                  generic validation (draft / strict) for ANY template
    styles.ts                  curated themes, fonts, music library
    index.ts                   definition registry
    renderers.tsx              renderer registry (compile error if one is missing)
    our-story/                 definition.ts + OurStoryRenderer.tsx + CSS
  components/
    editor/                    GenericEditor + FieldControl (schema-driven, template-agnostic)
    studio/                    customer flow: edit → preview → pay → finalize / failed / scheduled / live
    preview/PhoneFrame.tsx     preview frame + watermark
    admin/                     admin UI bits
  lib/
    lifecycle/                 state machine (pure, unit-tested)
    surprises/                 repository, publish, reports, scheduled/expiry jobs
    payments/                  PayMongo client, checkout, webhook + signature verification
    media/                     magic-byte sniffing, sharp re-encoding, storage adapter
    cleanup/                   deletion with verification, retries, backoff
    security/                  tokens, rate limiting, Turnstile, request helpers
  app/
    page.tsx                   landing
    surprises/                 catalog + template tab
    studio/[surpriseId]/       customer studio
    s/[token]/                 the recipient's surprise
    recover/  faq/             Find My Surprise, FAQ
    admin/                     dashboard + queues (Supabase Auth + allowlist)
    api/                       one route per operation
supabase/migrations/0001_init.sql
```

## Key guarantees

- **Payment ≠ publishing.** `payment_status` and `stage` are separate columns. PAID +
  PUBLISH_FAILED is recoverable by the customer (Try Again) or the admin (Retry Publish) — no
  second charge is possible because publishing never touches payments.
- **Webhook is the only source of truth for payment.** HMAC-verified, amount/currency
  cross-checked, idempotent (unique event id + unique payment id).
- **Idempotency everywhere it matters.** Checkout, publish and report requests carry an
  idempotency key; the database enforces one open-or-paid order per surprise and one running
  publish operation per surprise.
- **Locked after publication.** A database trigger rejects any content or photo change once
  `locked_at` is set; there is no edit route that bypasses it.
- **Private by default.** 256-bit public tokens, separate hashed edit tokens, peppered
  recovery codes, private storage with short-lived signed URLs, `noindex/noarchive`,
  `no-referrer`, RLS with no public policies, no customer HTML ever rendered.
- **Verified deletion.** Expired surprises are deleted, re-checked, and only then marked
  DELETED; failures retry with backoff and land in the admin queue.

## Decisions made while building (technical, not product)

| Decision | Why |
|---|---|
| Template fields live in code, not a `template_fields` table | They must change in lockstep with the typed renderer; one deploy updates both |
| Recovery code is 12 characters (e.g. `8F4K-2M91-XQ7P`) | 8 characters (40 bits) is too guessable for a code that unlocks private content |
| Redeeming a recovery code rotates the edit token | Prevents an old device from editing after recovery |
| Scheduled surprises stay editable until reveal; saves are strictly validated | Matches "edit until publication" and guarantees the reveal can't fail on incomplete content |
| 30 days count from the scheduled reveal time | Spec: hosting starts when it becomes live |
| Activation/expiry also happen lazily on view | Vercel Hobby cron is daily; correctness doesn't depend on cron frequency |
| Server re-encodes every photo with sharp | Guarantees real images, strips EXIF/GPS, enforces size even if browser compression is bypassed |
| Postgres-backed rate limiter | Free, works across serverless instances, no extra paid service |
| Music library ships empty | No licensed audio was available; the editor hides music until tracks are added |
| Abandoned unpaid drafts are deleted after 14 days of inactivity | Prevents unlimited server-side storage from drafts |

## Scripts

| Command | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
