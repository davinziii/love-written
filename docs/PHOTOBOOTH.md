# Photobooth — architecture

A private, two-person online photobooth. Person A pays (₱50), invites Person B (free), both
open their cameras, take **4** synchronized photos, **both** approve each one, and get a
real photobooth strip. Photos are deleted **7 days after completion**.

```
Person A pays ─▶ PAID ─▶ camera check ─▶ invite ─▶ design ─▶ 7-day notice ─▶ waiting
                                  (Person B: camera check ─▶ design ─▶ notice)
both set ─▶ IN_PROGRESS: [READY ─▶ COUNTDOWN ─▶ REVIEW] × 4 ─▶ GENERATING ─▶ COMPLETED
COMPLETED ─(7 days)─▶ EXPIRED ─▶ photos deleted + verified ─▶ DELETED
```

## Where things live

| Piece | File(s) |
|---|---|
| Database (tables, state functions) | `supabase/migrations/0005_photobooth.sql` |
| Rules (4 photos, 7 days, timings) | `src/lib/photobooth/constants.ts` |
| Server: links, presence, state, actions, strip | `src/lib/photobooth/session.ts` |
| Server: payments (PayMongo + manual) | `src/lib/photobooth/payments.ts`, `src/lib/payments/webhook.ts` |
| Server: images (validate, compose) | `src/lib/photobooth/images.ts` |
| Server: Realtime nudge | `src/lib/photobooth/realtime.ts` |
| Server: deletion | `src/lib/photobooth/cleanup.ts` (run by the daily maintenance cron) |
| API | `src/app/api/photobooth/**` |
| Browser: state sync, camera | `src/components/photobooth/useBooth.ts`, `useCamera.ts` |
| Browser: screens | `src/components/photobooth/BoothApp.tsx`, `BoothParts.tsx` |
| Frames | `src/photobooth/frames/**` + `public/photobooth/frames/**` — see [PHOTOBOOTH_FRAMES.md](PHOTOBOOTH_FRAMES.md) |
| Pages | `/photobooth` (product), `/photobooth/s/[id]#k=…` (session), `/admin/photobooth` |

## Session lifecycle

`photobooth_sessions.status`:

| Status | Meaning | Recoverable? |
|---|---|---|
| `AWAITING_PAYMENT` | self-serve, waiting for PayMongo | removed after 48 h if never paid |
| `PAID` | paid; camera check / invite / design / notice | **yes** — camera problems never leave this state |
| `IN_PROGRESS` | taking photos (`round_phase` = READY / COUNTDOWN / REVIEW) | yes — leave and come back anytime |
| `GENERATING` | all 4 approved; building the strip | retried automatically |
| `FINALIZATION_FAILED` | strip failed 3× | "Try again" button + admin retry; no new payment |
| `COMPLETED` | strip ready — **7-day clock starts here** (`completed_at` → `expires_at`) | — |
| `EXPIRED` | past 7 days; access already blocked; waiting for deletion | — |
| `CLEANUP_FAILED` | deletion failed 3× | admin "Delete photos now" |
| `DELETED` | photos, participants (= links) and rounds removed, verified | — |

Every transition happens in a SQL function (`pb_lobby`, `pb_ready`, `pb_shot`, `pb_decide`,
`pb_abort_stale`, `pb_claim_generation`, `pb_complete`) that locks the session row
(`SELECT … FOR UPDATE`). The browser never decides the state; it only asks.

**Camera problems are not failures.** A denied/missing/busy camera is recorded on the
participant (`camera_issue`) so the partner and support can see it, and the session stays
`PAID`/`IN_PROGRESS`. The person can retry, read instructions, switch devices (copy their
link) or come back later. Paid sessions nobody touches for **60 days** are cleaned up (same
rule as unpublished paid surprises) — the only way an unfinished paid session goes away.

## Participants & links

- Exactly two rows per session (`unique (session_id, role)`; role ∈ A, B) — a third
  participant is impossible.
- Each person has their own link: `/photobooth/s/<session id>#k=<token>`. The token
  (32 random bytes) is in the **fragment**, so it never reaches server logs. The browser
  sends it as `x-lw-booth-token`; the server compares SHA-256 hashes.
- An AES-GCM encrypted copy (`token_enc`, key derived from `APP_HASH_PEPPER`) lets Person A's
  screen show B's invite link and lets support re-send links.
- Unknown / expired links all get the same 404, and failures are rate-limited per IP
  (`boothAuthFail`) so links can't be enumerated.
- **One device per link at a time:** each browser has a random device id. If a link is open
  on another device that was active in the last 25 s, the new one sees *"This photobooth is
  already full"*. Once the old device goes quiet, the link works anywhere (so switching
  phones works, but a forwarded link can't join a session in progress).

## Realtime & timing

The database is the source of truth. After every change the server rings a **Supabase
Realtime Broadcast** channel named `booth-<realtime_key>` (a per-session secret) with an
empty `changed` event; both browsers then re-read `GET /api/photobooth/<id>`. Events carry
no data and clients never send any, so a forged event can only cause an extra refresh.
If Realtime is unavailable, browsers poll (1–2.5 s; slower when Realtime is connected).

**Synchronized countdown:** when the second person taps *I'm Ready*, the server stores
`capture_at = now() + 5 s`. Each browser keeps a server-clock offset (from the fastest
request round-trip) and fires the shutter at `capture_at` in server time — both phones
capture within a few tens of milliseconds even though their own clocks differ.

**Presence:** each state read updates `last_seen_at`; "connected" = seen in the last 15 s.
If someone disappears, the other person sees *"Your person disconnected. We're waiting for
them to come back."*; after **5 minutes** we add that both can come back later. The session
is never cancelled for being away — decision: anything stricter would punish a dropped
signal, and nothing is held up for anyone else.

**Stuck countdown:** if a photo never arrives within 45 s of the shutter, the next state
read restarts that photo (`pb_abort_stale`) and deletes the half-taken shot.

## Camera

`navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })`.
Video stays in the browser (the `<video>` preview is mirrored like a mirror). At the shutter,
a 900×1200 (3:4) still is drawn to a canvas (not mirrored, like a real print) and uploaded as
JPEG. Streams are stopped when leaving, on `pagehide`, and when the session no longer needs
the camera. Only `/photobooth/s/*` may use the camera (`Permissions-Policy` in `next.config.ts`).

## Photos, approval, output

- Upload: `POST /api/photobooth/<id>/shot` (multipart). The server checks the session is
  in COUNTDOWN for that attempt, validates the bytes (magic number, decodable, size, sane
  dimensions), re-encodes with sharp (metadata stripped), and stores it at a **server-chosen,
  deterministic** path `photobooth/<session>/r<round>-t<attempt>-<a|b>.jpg`. Retries
  overwrite the same object — never duplicates.
- Approval: a photo counts only when **A = KEEP and B = KEEP**. One RETAKE sends **both**
  back to the camera (new `attempt`, same photo number) and the old shots are deleted.
- Output: after photo 4, one worker claims generation (`pb_claim_generation`), downloads the
  8 photos, and `composeStrip(frame, photos)` places them into the frame's slots and lays the
  overlay on top → `photobooth-strip.jpg`, plus four side-by-side colour pairs
  (`photo-1..4.jpg`). Then `pb_complete` sets `completed_at` and `expires_at = +7 days`.
- Downloads are short-lived signed URLs (`Content-Disposition: attachment`). Downloading
  never extends retention.

## Payments

- **Self-serve (PayMongo, `NEXT_PUBLIC_PAYMENT_MODE=paymongo`):** `/photobooth` → *Create a
  Photobooth* → `POST /api/photobooth` (idempotent per `createKey`) creates the session +
  both participants + an order (`orders.photobooth_session_id`) and a checkout. The PayMongo
  **webhook is the only thing that marks it PAID** (same inbox / idempotency as surprises).
  Person B never sees a payment screen.
- **Manual (default):** customers message you; **Admin → Photobooth → Create Photobooth**
  records the payment and creates a PAID session in one transaction (idempotent per form),
  showing both links and a DM message.
- If payment succeeds but something later fails, nothing is re-charged: the session stays
  PAID and every later step can be retried.
- Price: `PHOTOBOOTH_PRICE_CENTAVOS` (default 5000 = ₱50).
- Future "free photobooth with a premium surprise": create a PAID session without a charge
  (like the manual path) — the session model doesn't care where the entitlement came from.

## Expiration & cleanup

Runs in the existing daily maintenance cron (`/api/cron/maintenance`), never in a browser:
completed sessions past `expires_at` → EXPIRED (access ends immediately — state reads also
treat an expired session as ended) → list & delete every object under
`photobooth/<session>/` → **verify** the folder is empty → delete rounds and participants
(every link stops working) → DELETED. Failures retry after 15 min / 1 h / 6 h, then
CLEANUP_FAILED with an email alert and the admin queue. Kept afterwards: the session row's
ids/timestamps/status and the order/payment (financial records).

## Admin & logs

`/admin/photobooth` lists sessions (filters: in progress, completed, needs attention) with
status, payment, photo number, completion and expiry. The detail page shows each person's
join time, last seen, camera status/problem and 7-day acceptance, both links (to re-send),
and actions: *Retry building the strip*, *Delete photos now*. Failed strips and failed
deletions show in the admin bell and send an email alert.

Structured log events: `photobooth_created`, `photobooth_payment_confirmed`,
`photobooth_camera_ready`, `photobooth_camera_permission_failed`, `photobooth_camera_retry_ok`,
`photobooth_participant_joined`, `photobooth_participant_reconnected`,
`photobooth_deletion_acknowledged`, `photobooth_round_started`, `photobooth_countdown_started`,
`photobooth_photo_uploaded`, `photobooth_photo_approved`, `photobooth_photo_retake`,
`photobooth_capture_aborted`, `photobooth_round_completed`,
`photobooth_output_generation_started`, `photobooth_output_generated`,
`photobooth_session_completed`, `photobooth_output_failed`, `photobooth_session_expired`,
`photobooth_cleanup_started`, `photobooth_cleanup_completed`, `photobooth_cleanup_failed`.
Never logged: tokens, photos, camera data.

## Setup checklist

1. Run `supabase/migrations/0005_photobooth.sql` in the Supabase SQL editor.
2. (Optional) `PHOTOBOOTH_PRICE_CENTAVOS` in Vercel.
3. Realtime is used automatically (Broadcast is on by default in Supabase). If you ever
   enable "private channels only" in Realtime settings, the booth simply falls back to polling.
4. HTTPS is required for cameras (Vercel provides it; `localhost` also works).

## Testing notes

- `tests/photobooth.test.ts` — frame configs, strip compositing, photo validation.
- The SQL state machine was exercised end-to-end on an in-memory Postgres (all migrations
  applied): idempotent creation, two-person limit, recoverable camera problems, ready/
  countdown, idempotent uploads, keep/retake for both, stuck countdown recovery, approve-once,
  one generation worker, complete-once, 7-day expiry from completion, one open order.
- Manual: open Person A's and Person B's links in two browsers (or a phone + laptop).
