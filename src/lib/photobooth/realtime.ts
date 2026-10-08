import "server-only";
import { env } from "@/lib/env";
import { log, errorMessage } from "@/lib/log";

/**
 * Realtime = a doorbell, not a messenger.
 *
 * After every state change the server rings a Supabase Realtime Broadcast channel named
 * after the session's secret realtime_key. The event carries NO data: both browsers just
 * re-read the state from the server (which checks their link). So a forged event can at
 * most cause an extra refresh — it can never change anything. Clients only listen.
 *
 * Best effort: if Realtime is unavailable, browsers fall back to polling.
 */
export function boothChannel(realtimeKey: string): string {
  return `booth-${realtimeKey}`;
}

export async function nudge(realtimeKey: string): Promise<void> {
  const e = env();
  try {
    const res = await fetch(`${e.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: e.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic: boothChannel(realtimeKey), event: "changed", payload: {} }] }),
      signal: AbortSignal.timeout(2_500),
    });
    if (!res.ok) log.warn("photobooth_realtime_failed", { status: res.status });
  } catch (err) {
    log.warn("photobooth_realtime_failed", { error: errorMessage(err) });
  }
}
