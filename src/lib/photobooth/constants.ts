/** Photobooth rules (shared by server and browser). Documented in docs/PHOTOBOOTH.md. */

/** Photos per strip for new sessions (each session also stores its own `photo_count`). Every frame has this many slots. */
export const PHOTOBOOTH_ROUNDS = 3;

/** Photos stay downloadable this many days AFTER the session is completed. */
export const PHOTOBOOTH_RETENTION_DAYS = 7;

/** A participant counts as "connected" if we heard from them this recently. */
export const PRESENCE_TIMEOUT_MS = 15_000;

/**
 * How long we wait for someone who dropped out before telling the other person it may be
 * a while. The session itself is never cancelled for being away.
 */
export const RECONNECT_WINDOW_MS = 5 * 60_000;

/** "Both ready" → shutter. Long enough for both phones to receive the time — even on slow mobile data — and still see 3 · 2 · 1. */
export const COUNTDOWN_LEAD_MS = 6_500;

/** A countdown whose photos never all arrived is restarted after this long. */
export const CAPTURE_GRACE_SECONDS = 45;

/** Another device may take over a link if the previous one has been silent this long. */
export const DEVICE_TAKEOVER_MS = 25_000;

/** Paid sessions nobody finishes are removed after this many idle days (same as surprises). */
export const PHOTOBOOTH_IDLE_DAYS = 60;

/** Unpaid self-serve sessions are removed after this long. */
export const PHOTOBOOTH_UNPAID_HOURS = 48;

/** Captured photo size (3:4 portrait) — two people side by side fill one strip slot. */
export const CAPTURE_WIDTH = 900;
export const CAPTURE_HEIGHT = 1200;
/** Solo photobooth: one landscape photo (3:2) fills a whole strip slot. */
export const SOLO_CAPTURE_WIDTH = 1200;
export const SOLO_CAPTURE_HEIGHT = 800;

export const PHOTOBOOTH_TIMEZONE = "Asia/Manila";
