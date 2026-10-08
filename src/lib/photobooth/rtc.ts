import "server-only";
import { db } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import { log, errorMessage } from "@/lib/log";
import { liveViewOn, type BoothContext } from "./session";
import { nudge } from "./realtime";
import type { RtcSignal } from "./types";

/**
 * Live view between the two people (WebRTC). The video is peer-to-peer and encrypted; our
 * server only relays one "session description" each way (non-trickle ICE), stored on the
 * participant row, and hands out relay (TURN) credentials.
 *
 * Relay: Cloudflare Realtime TURN when CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN are
 * set (needed on many mobile networks); otherwise public STUN only (direct connections).
 */

type IceServer = { urls: string | string[]; username?: string; credential?: string };

const STUN_ONLY: IceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
const CREDENTIAL_TTL_SECONDS = 24 * 3600;
let cached: { servers: IceServer[]; until: number } | null = null;

/** Port 53 TURN URLs time out in browsers; without trickle ICE they'd only slow things down. */
function withoutPort53(servers: IceServer[]): IceServer[] {
  return servers.map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)) }));
}

export async function iceServers(): Promise<IceServer[]> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return STUN_ONLY;
  if (cached && cached.until > Date.now()) return cached.servers;
  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ttl: CREDENTIAL_TTL_SECONDS }),
      signal: AbortSignal.timeout(4_000),
    });
    const body = (await res.json().catch(() => null)) as { iceServers?: IceServer[] | IceServer } | null;
    const list = body?.iceServers ? (Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers]) : null;
    if (!res.ok || !list?.length) throw new Error(`TURN credentials: HTTP ${res.status}`);
    // Reuse for half the credential lifetime so every session gets plenty of validity left.
    cached = { servers: withoutPort53(list), until: Date.now() + (CREDENTIAL_TTL_SECONDS * 1000) / 2 };
    return cached.servers;
  } catch (err) {
    log.warn("photobooth_turn_unavailable", { error: errorMessage(err) });
    return STUN_ONLY;
  }
}

const MAX_SDP = 16_000;

/**
 * Person A offers, Person B answers (or asks A for a fresh offer after reloading).
 * Only participants of a running session can signal, and only in their own role.
 */
export async function saveSignal(ctx: BoothContext, signal: RtcSignal): Promise<void> {
  const { session, me } = ctx;
  if (!liveViewOn(session.status)) throw Errors.conflict("BOOTH_STALE", "The live view isn't available right now.");
  const allowed =
    signal.type === "pause" || (me.role === "A" ? signal.type === "offer" : signal.type === "answer" || signal.type === "request");
  if (!allowed) throw Errors.badRequest();
  const needsSdp = signal.type === "offer" || signal.type === "answer";
  if (needsSdp !== (signal.sdp !== undefined)) throw Errors.badRequest();
  if (signal.sdp && signal.sdp.length > MAX_SDP) throw Errors.badRequest();

  const { error } = await db().from("photobooth_participants").update({ rtc_signal: signal }).eq("id", me.id);
  if (error) throw new Error(`save signal: ${error.message}`);
  await nudge(session.realtime_key);
}
