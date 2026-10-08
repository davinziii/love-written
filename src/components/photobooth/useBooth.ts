"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ClientApiError } from "@/lib/client/api";
import { boothApi, readBoothToken } from "@/lib/photobooth/client";
import type { BoothState } from "@/lib/photobooth/types";

export type BoothLoadError = { code: string; message: string };

/**
 * Keeps this browser in sync with the server (the source of truth):
 *   • Realtime "changed" nudges → re-read immediately (Supabase Broadcast, if available)
 *   • polling as a safety net, faster during the countdown and review
 *   • a server-clock offset so both phones fire the shutter at the same moment
 * Each read also tells the server we're still here (presence).
 */
export function useBooth(sessionId: string, { slow = false }: { slow?: boolean } = {}) {
  // undefined while rendering on the server; null when this device has no link for it.
  const token = useSyncExternalStore(
    noSubscribe,
    () => readBoothToken(sessionId),
    () => undefined,
  );
  const [state, setState] = useState<BoothState | null>(null);
  const [loadError, setLoadError] = useState<BoothLoadError | null>(null);
  const [offline, setOffline] = useState(false);
  const [live, setLive] = useState(false);
  const offset = useRef<{ ms: number; rtt: number }>({ ms: 0, rtt: Infinity });
  const inFlight = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (!token) return;
    // One read at a time; a nudge that arrives mid-read triggers exactly one more.
    if (inFlight.current) {
      again.current = true;
      return inFlight.current;
    }
    const readOnce = async () => {
      const t0 = Date.now();
      try {
        const next = await boothApi<BoothState>(sessionId, token, "", { retries: 1 });
        const t1 = Date.now();
        // Keep the offset from the fastest round trip seen (least network noise).
        const rtt = t1 - t0;
        if (rtt <= offset.current.rtt + 40) offset.current = { ms: next.serverNow - (t0 + t1) / 2, rtt: Math.min(rtt, offset.current.rtt) };
        setState(next);
        setLoadError(null);
        setOffline(false);
      } catch (err) {
        if (err instanceof ClientApiError && err.code === "NETWORK") setOffline(true);
        else if (err instanceof ClientApiError && (err.status === 404 || err.status === 409 || err.status === 429)) {
          setLoadError({ code: err.code, message: err.message });
        }
      }
    };
    const run = (async () => {
      do {
        again.current = false;
        await readOnce();
      } while (again.current);
    })();
    inFlight.current = run;
    try {
      await run;
    } finally {
      inFlight.current = null;
    }
  }, [sessionId, token]);

  // Polling: quicker while photos are being taken; slower when Realtime is connected.
  const status = state?.status;
  const phase = state?.phase;
  useEffect(() => {
    if (token) void refresh();
  }, [token, refresh]);

  useEffect(() => {
    if (!token || status === "COMPLETED" || status === "EXPIRED" || status === "DELETED") return;
    const base =
      status === "IN_PROGRESS" ? (phase === "COUNTDOWN" ? 1000 : 1500) : status === "GENERATING" ? 2000 : status === "AWAITING_PAYMENT" ? 4000 : 2500;
    // Away (idle / paused): check rarely — saves requests while nobody is looking.
    const every = slow ? 10_000 : live ? Math.min(base * 2, 5000) : base;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, every);
    return () => window.clearInterval(id);
  }, [token, status, phase, live, slow, refresh]);

  // Back in the tab / back online → catch up at once.
  useEffect(() => {
    const now = () => void refresh();
    const onVisible = () => document.visibilityState === "visible" && now();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", now);
    window.addEventListener("pageshow", now);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", now);
      window.removeEventListener("pageshow", now);
    };
  }, [refresh]);

  // Realtime doorbell (loaded lazily; the booth works without it).
  const realtimeKey = state?.realtimeKey;
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!realtimeKey || !url || !anon) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void import("@supabase/supabase-js").then(({ createClient }) => {
      if (cancelled) return;
      const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
      const channel = client
        .channel(`booth-${realtimeKey}`)
        .on("broadcast", { event: "changed" }, () => void refresh())
        .subscribe((s) => setLive(s === "SUBSCRIBED"));
      cleanup = () => {
        void client.removeChannel(channel);
        setLive(false);
      };
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [realtimeKey, refresh]);

  /** Perform an action, then re-read the state. */
  const act = useCallback(
    async (path: string, body: unknown, retries = 1) => {
      if (!token) return;
      try {
        await boothApi(sessionId, token, path, { method: "POST", body, retries });
      } finally {
        await refresh();
      }
    },
    [sessionId, token, refresh],
  );

  /** Server time now, in this browser's clock terms. */
  const serverNow = useCallback(() => Date.now() + offset.current.ms, []);

  return { token, state, loadError, offline, live, refresh, act, serverNow };
}

export type Booth = ReturnType<typeof useBooth>;

const noSubscribe = () => () => {};
