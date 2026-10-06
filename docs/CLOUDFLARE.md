# Cloudflare setup (Free plan)

Cloudflare is an **extra** layer. The app already rate-limits, validates and authorizes
everything itself, so nothing breaks if a Cloudflare rule is missing.
Check Cloudflare's current dashboard docs as you go — menu names change.

## 1. DNS & SSL

1. Add your domain to Cloudflare and point the nameservers at it.
2. Add Vercel's DNS records (from Vercel → Domains). Proxy status **Proxied** (orange cloud).
3. SSL/TLS mode: **Full (strict)**. Enable **Always Use HTTPS**.
4. Note: Vercel supports running behind a proxy, but if you see redirect loops or certificate
   issues, set the record to **DNS only** temporarily and re-check SSL mode.

## 2. Don't break the PayMongo webhook

`POST /api/webhooks/paymongo` comes from PayMongo's servers, not a browser — it can't solve
challenges. Create a **WAF custom rule** first:

- **Name:** Allow PayMongo webhook
- **Expression:** `(http.request.uri.path eq "/api/webhooks/paymongo" and http.request.method eq "POST")`
- **Action:** Skip → all remaining custom rules, rate limiting rules, and Super Bot Fight Mode / managed rules where offered

The endpoint is still protected by HMAC signature verification in the app.

> **Bot Fight Mode** (free) can't be bypassed by skip rules on the Free plan. If you turn it
> on, send a PayMongo test webhook and confirm it arrives (Vercel logs show
> `payment_confirmed` or `webhook_ignored`). If webhooks start failing, turn Bot Fight Mode off —
> the app's own protections remain in place.

Similarly `/api/cron/maintenance` is called by Vercel Cron / Supabase `pg_cron` — skip it too
(it requires the `CRON_SECRET` bearer token anyway).

## 3. Rate limiting rule (Free plan allows one)

Use it on the most guessable endpoint, recovery:

- **If:** `http.request.uri.path eq "/api/recover"`
- **Rate:** 10 requests per 10 seconds per IP (Free plan granularity) → **Block** for 10 seconds

The app additionally enforces 5 attempts / 15 min per IP and a global cap.

## 4. Turnstile

1. Turnstile → **Add site** → your domain → widget mode **Managed**.
2. Put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the secret in `TURNSTILE_SECRET_KEY`.
3. It's used on **Customize** (draft creation) and **Find My Surprise**. Leave both blank to disable.

## 5. Things NOT to challenge

Don't put managed challenges on:

- `/s/*` — recipients open links from Messenger/Instagram in-app browsers; a challenge there
  ruins the moment. Those pages are already rate limited in the app.
- `/studio/*` and `/api/surprises/*` — autosave and uploads run in the background.
- `/admin/*` — protected by Supabase Auth + allowlist.

## 6. Caching

Leave Cloudflare caching at defaults. The app sends `Cache-Control: private, no-store` for
`/s/*`, `/studio/*` and `/api/*`, so private pages are never cached at the edge.
