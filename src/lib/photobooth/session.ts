import "server-only";
import { after } from "next/server";
import { db } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { ApiError, Errors } from "@/lib/errors";
import { log, errorMessage } from "@/lib/log";
import { alert } from "@/lib/alerts";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { ipKey } from "@/lib/security/request";
import { randomToken, sha256Hex } from "@/lib/security/tokens";
import { openSecret, sealSecret } from "@/lib/security/access-vault";
import { getObject, putObject, removeObjects, signedUrl } from "@/lib/media/storage";
import type { PhotoboothParticipantRow, PhotoboothRoundRow, PhotoboothSessionRow } from "@/lib/db-types";
import { DEFAULT_FRAME_ID, getFrame } from "@/photobooth/frames";
import {
  CAPTURE_GRACE_SECONDS,
  COUNTDOWN_LEAD_MS,
  DEVICE_TAKEOVER_MS,
  PHOTOBOOTH_RETENTION_DAYS,
  PHOTOBOOTH_ROUNDS,
  PRESENCE_TIMEOUT_MS,
} from "./constants";
import type { BoothPersonState, BoothRole, BoothState, CameraIssue, Decision } from "./types";
import { composePair, composeStrip, processShot, type RoundPhotos } from "./images";
import { nudge } from "./realtime";

/**
 * Photobooth sessions on the server: link checks, presence, the state each person sees,
 * and every action. All state changes go through the pb_* SQL functions (0005), which lock
 * the session row — the browser never decides what state the session is in.
 */

export const BOOTH_TOKEN_HEADER = "x-lw-booth-token";
export const BOOTH_DEVICE_HEADER = "x-lw-booth-device";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERATION_STALE_SECONDS = 90;
const MAX_GENERATION_ATTEMPTS = 3;

export const BoothErrors = {
  notFound: () => new ApiError(404, "BOOTH_NOT_FOUND", "This photobooth link isn't valid, or the photobooth has ended."),
  inUse: () =>
    new ApiError(
      409,
      "BOOTH_IN_USE",
      "This photobooth is already full — this link is open on another device right now. If that's you, close it there and try again in a moment.",
    ),
  stale: () => new ApiError(409, "BOOTH_STALE", "The photobooth moved on — refreshing."),
};

// ─── Storage paths (server-controlled; never from the client) ──────────────

export const boothFolder = (sessionId: string) => `photobooth/${sessionId}`;
const shotPath = (sessionId: string, round: number, attempt: number, role: BoothRole) =>
  `${boothFolder(sessionId)}/r${round}-t${attempt}-${role.toLowerCase()}.jpg`;
const stripPath = (sessionId: string) => `${boothFolder(sessionId)}/photobooth-strip.jpg`;
const pairPath = (sessionId: string, round: number) => `${boothFolder(sessionId)}/photo-${round}.jpg`;

// ─── Links ──────────────────────────────────────────────────────────────────

/** The token travels in the URL fragment (#k=…), which browsers never send to the server. */
export function participantLink(sessionId: string, token: string): string {
  return `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/photobooth/s/${sessionId}#k=${token}`;
}

export function newParticipantCredentials() {
  const a = randomToken();
  const b = randomToken();
  return { a, b, aHash: sha256Hex(a), bHash: sha256Hex(b), aEnc: sealSecret(a), bEnc: sealSecret(b) };
}

/** Both links (for Person A's screen, admin support and the order confirmation). */
export async function participantLinks(sessionId: string): Promise<{ a: string | null; b: string | null }> {
  const { data } = await db().from("photobooth_participants").select("role, token_enc").eq("session_id", sessionId);
  const out: { a: string | null; b: string | null } = { a: null, b: null };
  for (const p of (data ?? []) as Pick<PhotoboothParticipantRow, "role" | "token_enc">[]) {
    const token = openSecret(p.token_enc);
    if (token) out[p.role === "A" ? "a" : "b"] = participantLink(sessionId, token);
  }
  return out;
}

// ─── Authorization ──────────────────────────────────────────────────────────

export interface BoothContext {
  session: PhotoboothSessionRow;
  me: PhotoboothParticipantRow;
  partner: PhotoboothParticipantRow;
}

async function loadSession(sessionId: string): Promise<PhotoboothSessionRow | null> {
  const { data, error } = await db().from("photobooth_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(`load photobooth: ${error.message}`);
  return data as PhotoboothSessionRow | null;
}

/**
 * The private link is the credential. Unknown/expired links all get the same answer, and
 * failures are rate-limited per IP so links can't be guessed.
 */
export async function authorizeBooth(sessionId: string, req: Request, { claimDevice = false } = {}): Promise<BoothContext> {
  const token = req.headers.get(BOOTH_TOKEN_HEADER);
  const device = req.headers.get(BOOTH_DEVICE_HEADER)?.slice(0, 64) ?? null;
  const fail = async () => {
    await checkRateLimit("boothAuthFail", ipKey(req.headers), { failOpen: true }).then((ok) => {
      if (!ok) throw Errors.rateLimited();
    });
    return BoothErrors.notFound();
  };
  if (!UUID.test(sessionId) || !token || !TOKEN_PATTERN.test(token)) throw await fail();

  const { data: rows, error } = await db().from("photobooth_participants").select("*").eq("session_id", sessionId);
  if (error) throw new Error(`load participants: ${error.message}`);
  const participants = (rows ?? []) as PhotoboothParticipantRow[];
  const hash = sha256Hex(token);
  const me = participants.find((p) => p.token_hash === hash);
  const partner = participants.find((p) => p.role !== me?.role);
  const session = me ? await loadSession(sessionId) : null;
  if (!me || !partner || !session || session.status === "DELETED") throw await fail();

  // One device per link at a time while the photobooth is running. A new device can take over
  // once the old one goes quiet, so switching phones works — but a forwarded link can't join a
  // session in progress. Results (COMPLETED) can be opened on any number of devices.
  const running = session.status === "PAID" || session.status === "IN_PROGRESS";
  if (claimDevice && running && device && me.device_id && me.device_id !== device && me.last_seen_at) {
    if (Date.now() - new Date(me.last_seen_at).getTime() < DEVICE_TAKEOVER_MS) throw BoothErrors.inUse();
  }
  return { session, me, partner };
}

/** Record that this person is here. Returns true when the partner should be told (join/return). */
export async function touchPresence(ctx: BoothContext, req: Request): Promise<boolean> {
  const device = req.headers.get(BOOTH_DEVICE_HEADER)?.slice(0, 64) ?? null;
  const { me, session } = ctx;
  const last = me.last_seen_at ? new Date(me.last_seen_at).getTime() : 0;
  const gap = Date.now() - last;
  const changedDevice = Boolean(device && device !== me.device_id);
  const firstJoin = !me.joined_at;
  if (!firstJoin && gap < 4_000 && !changedDevice) return false;

  const now = new Date().toISOString();
  await db()
    .from("photobooth_participants")
    .update({ last_seen_at: now, joined_at: me.joined_at ?? now, ...(device ? { device_id: device } : {}) })
    .eq("id", me.id);
  me.last_seen_at = now;
  me.joined_at = me.joined_at ?? now;
  if (device) me.device_id = device;

  if (firstJoin) {
    log.info("photobooth_participant_joined", { sessionId: session.id, role: me.role });
    return true;
  }
  if (gap > PRESENCE_TIMEOUT_MS) {
    log.info("photobooth_participant_reconnected", { sessionId: session.id, role: me.role, awaySeconds: Math.round(gap / 1000) });
    return true;
  }
  return changedDevice;
}

export async function enforceBoothAction(ctx: BoothContext) {
  if (!(await checkRateLimit("boothAction", ctx.me.id))) throw Errors.rateLimited();
}

// ─── State for the browser ──────────────────────────────────────────────────

function person(p: PhotoboothParticipantRow, s: PhotoboothSessionRow, round: PhotoboothRoundRow | undefined): BoothPersonState {
  const seen = p.last_seen_at ? Date.now() - new Date(p.last_seen_at).getTime() : null;
  const isA = p.role === "A";
  return {
    joined: Boolean(p.joined_at),
    connected: seen !== null && seen < PRESENCE_TIMEOUT_MS,
    awayMs: seen,
    cameraReady: Boolean(p.camera_ready_at),
    cameraIssue: p.camera_issue,
    acknowledged: Boolean(p.deletion_ack_at),
    ready: s.status === "IN_PROGRESS" && p.ready_attempt === s.attempt,
    uploaded: Boolean(round && (isA ? round.a_path : round.b_path)),
    decision: round ? (isA ? round.a_decision : round.b_decision) : null,
  };
}

const isExpired = (s: PhotoboothSessionRow) => s.status === "COMPLETED" && s.expires_at !== null && new Date(s.expires_at).getTime() <= Date.now();

export async function buildState(ctx: BoothContext): Promise<BoothState> {
  const { session: s, me, partner } = ctx;
  const { data: roundRows } = await db()
    .from("photobooth_rounds")
    .select("*")
    .eq("session_id", s.id)
    .in("attempt", [s.attempt, s.attempt - 1]);
  const rounds = (roundRows ?? []) as PhotoboothRoundRow[];
  const current = s.status === "IN_PROGRESS" ? rounds.find((r) => r.attempt === s.attempt) : undefined;
  const previous = rounds.find((r) => r.attempt === s.attempt - 1 && r.round === s.current_round);

  let notice: BoothState["notice"] = null;
  if (s.status === "IN_PROGRESS" && s.round_phase === "READY" && previous) {
    if (previous.status === "RETAKEN") notice = { kind: "retake", by: previous.retake_by === me.role ? "me" : "partner" };
    else if (previous.status === "ABORTED") notice = { kind: "aborted" };
  }

  let review: BoothState["review"] = null;
  if (s.status === "IN_PROGRESS" && s.round_phase === "REVIEW" && current?.a_path && current.b_path) {
    const [mine, theirs] = await Promise.all([
      signedUrl(me.role === "A" ? current.a_path : current.b_path, { ttlSeconds: 900 }),
      signedUrl(me.role === "A" ? current.b_path : current.a_path, { ttlSeconds: 900 }),
    ]);
    review = { mine, theirs };
  }

  const expired = isExpired(s);
  let result: BoothState["result"] = null;
  if (s.status === "COMPLETED" && !expired && s.output_path && s.expires_at && s.completed_at) {
    const rounds4 = Array.from({ length: PHOTOBOOTH_ROUNDS }, (_, i) => i + 1);
    const [stripUrl, stripDownload, ...photoUrls] = await Promise.all([
      signedUrl(s.output_path),
      signedUrl(s.output_path, { download: "love-written-photobooth.jpg" }),
      ...rounds4.flatMap((n) => [signedUrl(pairPath(s.id, n)), signedUrl(pairPath(s.id, n), { download: `love-written-photo-${n}.jpg` })]),
    ]);
    result = {
      strip: { url: stripUrl!, download: stripDownload! },
      photos: rounds4.map((n, i) => ({ round: n, url: photoUrls[i * 2]!, download: photoUrls[i * 2 + 1]! })),
      expiresAt: s.expires_at,
      completedAt: s.completed_at,
    };
  }

  const inviteToken = me.role === "A" ? openSecret(partner.token_enc) : null;
  return {
    serverNow: Date.now(),
    sessionId: s.id,
    status: expired ? "EXPIRED" : s.status,
    paymentStatus: s.payment_status,
    priceCentavos: s.price_centavos,
    frameId: s.frame_id,
    round: s.current_round,
    attempt: s.attempt,
    phase: s.status === "IN_PROGRESS" ? s.round_phase : null,
    captureAt: s.capture_at ? new Date(s.capture_at).getTime() : null,
    notice,
    realtimeKey: s.realtime_key,
    me: { ...person(me, s, current), role: me.role },
    partner: person(partner, s, current),
    inviteLink: inviteToken ? participantLink(s.id, inviteToken) : null,
    review,
    result,
  };
}

/**
 * Housekeeping that piggybacks on state reads so a session never gets stuck waiting for a
 * browser: restart a countdown whose photos never arrived, and (re)start strip generation.
 */
export async function reconcile(ctx: BoothContext): Promise<boolean> {
  const s = ctx.session;
  if (s.status === "IN_PROGRESS" && s.round_phase === "COUNTDOWN" && s.capture_at) {
    if (Date.now() - new Date(s.capture_at).getTime() > CAPTURE_GRACE_SECONDS * 1000) {
      const { data } = await db().rpc("pb_abort_stale", { p_session: s.id, p_grace_seconds: CAPTURE_GRACE_SECONDS });
      const row = (Array.isArray(data) ? data[0] : data) as { aborted: boolean; delete_a: string | null; delete_b: string | null } | undefined;
      if (row?.aborted) {
        log.warn("photobooth_capture_aborted", { sessionId: s.id, attempt: s.attempt });
        await removeQuietly([row.delete_a, row.delete_b]);
        return true;
      }
    }
  }
  if (s.status === "GENERATING") {
    const claimed = s.generation_claimed_at ? new Date(s.generation_claimed_at).getTime() : 0;
    if (Date.now() - claimed > GENERATION_STALE_SECONDS * 1000) after(() => finalizeBooth(s.id));
  }
  return false;
}

async function removeQuietly(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await removeObjects(list).catch((err) => log.warn("photobooth_remove_failed", { error: errorMessage(err) }));
}

// ─── Actions ────────────────────────────────────────────────────────────────

const one = <T>(data: unknown): T | undefined => (Array.isArray(data) ? data[0] : data) as T | undefined;

export async function lobbyUpdate(
  ctx: BoothContext,
  input: { cameraReady?: boolean; cameraIssue?: CameraIssue | null; acknowledge?: boolean; frameId?: string },
): Promise<void> {
  if (input.frameId !== undefined && !getFrame(input.frameId)) throw Errors.badRequest("That photobooth design isn't available.");
  if (input.acknowledge === false) throw Errors.badRequest("Please confirm you understand the 7-day deletion policy.");
  const { data, error } = await db().rpc("pb_lobby", {
    p_session: ctx.session.id,
    p_role: ctx.me.role,
    p_camera_ready: input.cameraReady === true,
    p_camera_issue: input.cameraIssue ?? null,
    p_clear_issue: input.cameraIssue === null,
    p_ack: input.acknowledge === true,
    p_frame: input.frameId ?? null,
  });
  if (error) throw new Error(`pb_lobby: ${error.message}`);
  const row = one<{ ok: boolean; status: string; started: boolean }>(data);
  const meta = { sessionId: ctx.session.id, role: ctx.me.role };
  if (input.cameraReady) log.info(ctx.me.camera_issue ? "photobooth_camera_retry_ok" : "photobooth_camera_ready", meta);
  if (input.cameraIssue) log.warn("photobooth_camera_permission_failed", { ...meta, issue: input.cameraIssue });
  if (input.acknowledge) log.info("photobooth_deletion_acknowledged", meta);
  if (row?.started) log.info("photobooth_round_started", { sessionId: ctx.session.id, round: 1 });
  await nudge(ctx.session.realtime_key);
}

export async function markReady(ctx: BoothContext, attempt: number): Promise<void> {
  const { data, error } = await db().rpc("pb_ready", {
    p_session: ctx.session.id,
    p_role: ctx.me.role,
    p_attempt: attempt,
    p_lead_ms: COUNTDOWN_LEAD_MS,
  });
  if (error) throw new Error(`pb_ready: ${error.message}`);
  const row = one<{ ok: boolean; phase: string }>(data);
  if (!row?.ok) throw BoothErrors.stale();
  if (row.phase === "COUNTDOWN") log.info("photobooth_countdown_started", { sessionId: ctx.session.id, round: ctx.session.current_round, attempt });
  await nudge(ctx.session.realtime_key);
}

export async function saveShot(ctx: BoothContext, attempt: number, file: Uint8Array): Promise<void> {
  const s = ctx.session;
  if (s.status !== "IN_PROGRESS" || s.round_phase !== "COUNTDOWN" || s.attempt !== attempt) throw BoothErrors.stale();
  if (!(await checkRateLimit("boothShot", s.id))) throw Errors.rateLimited();

  const jpeg = await processShot(file);
  // Same round + attempt + person → same path, so a retried upload replaces, never duplicates.
  const path = shotPath(s.id, s.current_round, attempt, ctx.me.role);
  await putObject(path, jpeg, "image/jpeg", { upsert: true });

  const { data, error } = await db().rpc("pb_shot", { p_session: s.id, p_role: ctx.me.role, p_attempt: attempt, p_path: path });
  if (error) throw new Error(`pb_shot: ${error.message}`);
  const row = one<{ ok: boolean; phase: string }>(data);
  if (!row?.ok) {
    await removeQuietly([path]);
    throw BoothErrors.stale();
  }
  log.info("photobooth_photo_uploaded", { sessionId: s.id, role: ctx.me.role, round: s.current_round, attempt });
  await nudge(s.realtime_key);
}

export async function decide(ctx: BoothContext, attempt: number, decision: Decision): Promise<void> {
  const s = ctx.session;
  const { data, error } = await db().rpc("pb_decide", { p_session: s.id, p_role: ctx.me.role, p_attempt: attempt, p_decision: decision });
  if (error) throw new Error(`pb_decide: ${error.message}`);
  const row = one<{ ok: boolean; action: string; delete_a: string | null; delete_b: string | null }>(data);
  if (!row?.ok) throw BoothErrors.stale();
  const meta = { sessionId: s.id, role: ctx.me.role, round: s.current_round, attempt };
  if (row.action === "RETAKE") {
    log.info("photobooth_photo_retake", meta);
    await removeQuietly([row.delete_a, row.delete_b]);
  } else if (row.action === "APPROVED") {
    log.info("photobooth_round_completed", meta);
  } else if (row.action === "COMPLETE") {
    log.info("photobooth_round_completed", meta);
    after(() => finalizeBooth(s.id));
  } else {
    log.info("photobooth_photo_approved", meta);
  }
  await nudge(s.realtime_key);
}

// ─── Final strip ────────────────────────────────────────────────────────────

/** Build the strip + the 4 photos. Idempotent: only one claim at a time, outputs overwrite. */
export async function finalizeBooth(sessionId: string): Promise<void> {
  const { data: claimed, error: claimError } = await db().rpc("pb_claim_generation", {
    p_session: sessionId,
    p_stale_seconds: GENERATION_STALE_SECONDS,
  });
  if (claimError) {
    log.error("photobooth_output_claim_failed", { sessionId, error: claimError.message });
    return;
  }
  if (claimed !== true) return;

  const session = await loadSession(sessionId);
  if (!session) return;
  log.info("photobooth_output_generation_started", { sessionId, attempt: session.generation_attempts });
  try {
    const { data, error } = await db()
      .from("photobooth_rounds")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "APPROVED")
      .order("round", { ascending: true });
    if (error) throw new Error(error.message);
    const approved = (data ?? []) as PhotoboothRoundRow[];
    if (approved.length !== PHOTOBOOTH_ROUNDS || approved.some((r) => !r.a_path || !r.b_path)) {
      throw new Error(`expected ${PHOTOBOOTH_ROUNDS} approved rounds, found ${approved.length}`);
    }
    const photos: RoundPhotos[] = await Promise.all(
      approved.map(async (r) => ({ round: r.round, a: await getObject(r.a_path!), b: await getObject(r.b_path!) })),
    );
    const frame = getFrame(session.frame_id) ?? getFrame(DEFAULT_FRAME_ID)!;
    const [strip, ...pairs] = await Promise.all([composeStrip(frame, photos), ...photos.map((p) => composePair(p))]);
    await Promise.all([
      putObject(stripPath(sessionId), strip, "image/jpeg", { upsert: true }),
      ...pairs.map((buf, i) => putObject(pairPath(sessionId, i + 1), buf, "image/jpeg", { upsert: true })),
    ]);
    const { data: done, error: completeError } = await db().rpc("pb_complete", {
      p_session: sessionId,
      p_output_path: stripPath(sessionId),
      p_retention_days: PHOTOBOOTH_RETENTION_DAYS,
    });
    if (completeError) throw new Error(completeError.message);
    if (done === true) {
      log.info("photobooth_output_generated", { sessionId, frameId: frame.id });
      log.info("photobooth_session_completed", { sessionId });
    }
  } catch (err) {
    const message = errorMessage(err).slice(0, 500);
    const giveUp = session.generation_attempts >= MAX_GENERATION_ATTEMPTS;
    log.error("photobooth_output_failed", { sessionId, attempt: session.generation_attempts, error: message });
    await db()
      .from("photobooth_sessions")
      .update({ generation_error: message, ...(giveUp ? { status: "FINALIZATION_FAILED" } : { generation_claimed_at: null }) })
      .eq("id", sessionId)
      .eq("status", "GENERATING");
    if (giveUp) alert("photobooth_failed", { "Photobooth": sessionId, "Problem": "Couldn't build the photo strip" });
  }
  await nudge(session.realtime_key);
}

/** "Try again" after FINALIZATION_FAILED (participant or admin). Never needs a new payment. */
export async function retryFinalize(sessionId: string): Promise<void> {
  await db()
    .from("photobooth_sessions")
    .update({ status: "GENERATING", generation_claimed_at: null, generation_attempts: 0, generation_error: null })
    .eq("id", sessionId)
    .eq("status", "FINALIZATION_FAILED");
  await finalizeBooth(sessionId);
}
