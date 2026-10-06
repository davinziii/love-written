# Testing

## Automated (no services needed)

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

| Suite | Covers |
|---|---|
| `tests/schema.test.ts` | required vs optional, strict vs draft, max length, HTML/control-character handling, curated style options, invalid dates, unknown keys, template registry sanity |
| `tests/security.test.ts` | token entropy/format, enumeration-resistant token pattern, recovery code normalization + peppered hashing, PayMongo signature (valid, test vs live, tampered, malformed), image magic-byte sniffing |
| `tests/lifecycle.test.ts` | edit lock, payment vs publish independence, scheduled access before/at reveal, expiry at read time, 30-day window, schedule bounds |

Database guarantees (idempotency, single active order, single running publish, content
immutability) are enforced by unique indexes and triggers in the migration and are exercised
by the manual scenarios below.

## Manual end-to-end (Supabase + PayMongo **test mode**)

Use `.env.local` with test keys. To receive webhooks locally, expose the dev server with a
tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) and register that URL as a
test webhook.

### Manual payment flow (launch)
- [ ] Landing → Pick a Surprise → Our Story shows "Message us" and the 3 ordering steps
- [ ] `POST /api/surprises` and `/checkout` return 403 `MANUAL_ORDERS_ONLY`
- [ ] /admin → Create Surprise → submit twice quickly → exactly one order; link + recovery code + DM message shown once
- [ ] Open the link on a phone → lands in the editor, the `#access=…` part disappears from the address bar, no watermark
- [ ] Preview & publish → Publish now / Schedule → confirmation → live
- [ ] "New customer link" → old link shows "This surprise is protected", new link works
- [ ] Desktop / Mobile / Full preview switch works in the studio, template page and landing page

### Customer flow
- [ ] Pick a Surprise → Our Story → Customize creates a draft and shows a recovery code
- [ ] Typing updates the preview instantly; theme and font switch live
- [ ] Upload a 10 MB phone photo → it's compressed and appears; a `.txt` renamed to `.jpg` is rejected
- [ ] Leave "Final message" empty → Preview highlights it
- [ ] Close the tab mid-typing, reopen `/surprises` → "Welcome back ❤️" → Continue editing restores text
- [ ] Clear site data → Find My Surprise with the recovery code restores it on this device
- [ ] Preview shows the watermark
- [ ] Pay with a PayMongo test method → "Confirming your payment…" → Payment received ✅
- [ ] Cancel on PayMongo → "you haven't been charged"
- [ ] Publish Now → confirmation dialog → live link; editing is gone; `/s/<token>` opens
- [ ] Schedule (10 min ahead) → link opens a countdown; at the time it opens automatically
- [ ] While scheduled, edit content (still allowed) and try to clear a required field (rejected)

### Payment
- [ ] Resend the same webhook from PayMongo's dashboard → no duplicate payment, `duplicate: true`
- [ ] Send a webhook with a wrong signature → 401, nothing changes
- [ ] Double-click "Continue to payment" → one order, same checkout URL

### Paid but publish failed
- [ ] Set `LW_FAULT_INJECT_PUBLISH=1`, restart, publish → "We received your payment… Do not pay again."
- [ ] Report This Problem → `RPT-XXXXX-XXXX`; admin Reports shows it linked to order + PayMongo ref + operation
- [ ] Admin → Failed Publish shows it; unset the flag, restart, **Retry Publish** → published, no new order
- [ ] Customer **Try Again** also works, and double-clicking it creates one operation

### Expiry & cleanup
- [ ] In SQL, set `expires_at = now() - interval '1 minute'` on a published surprise → `/s/…` says "ended"
- [ ] Call the cron endpoint → stage `DELETED`, storage folder empty, `content = {}`
- [ ] Make cleanup fail (e.g. temporarily wrong bucket name) → job retries with backoff, after 3 → `CLEANUP_FAILED` in admin; fix and **Retry cleanup**

### Security
- [ ] `/s/1`, `/s/abc` → not found without a database query
- [ ] Response headers on `/s/<token>`: `X-Robots-Tag: noindex, nofollow, noarchive`, `Referrer-Policy: no-referrer`
- [ ] Using the anon key directly against the REST API (`/rest/v1/surprises`) returns no rows
- [ ] Bucket objects can't be fetched without a signed URL
- [ ] `/admin` without signing in redirects to login; a signed-in non-admin is rejected
- [ ] 6 wrong recovery codes from one IP within 15 min → rate limited
- [ ] Enter `<img src=x onerror=alert(1)>` as a message → shown as literal text

### Devices
- [ ] Small phone (iPhone SE width 320–375px), modern phone, tablet, desktop
- [ ] Messenger / Instagram in-app browser opens the link
- [ ] OS "reduce motion" on → no floating hearts, content still visible
