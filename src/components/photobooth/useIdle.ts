"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type IdleState = "active" | "asking" | "paused";

/** No tap / key for this long → "Are you still there?" */
export const IDLE_ASK_MS = 3 * 60_000;
/** Unanswered for this long → pause the live video. */
export const IDLE_PAUSE_AFTER_ASK_MS = 60_000;
/** Page hidden (switched apps / locked phone) this long → pause. */
const HIDDEN_PAUSE_MS = 20_000;

/**
 * Saves video relay data (and server requests) when someone walks away: ask first, then
 * pause the live view. A tap, a key or coming back to the page resumes immediately.
 */
export function useIdle(enabled: boolean) {
  const [state, setState] = useState<IdleState>("active");
  const last = useRef(0);
  const askedAt = useRef(0);
  const hiddenAt = useRef<number | null>(null);

  const resume = useCallback(() => {
    last.current = Date.now();
    setState("active");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    last.current = Date.now();
    const onActivity = () => {
      last.current = Date.now();
      setState((s) => (s === "active" ? s : "active"));
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt.current = Date.now();
      else {
        hiddenAt.current = null;
        onActivity();
      }
    };
    const tick = window.setInterval(() => {
      const now = Date.now();
      if (hiddenAt.current && now - hiddenAt.current > HIDDEN_PAUSE_MS) {
        setState("paused");
        return;
      }
      setState((s) => {
        if (s === "active" && now - last.current > IDLE_ASK_MS) {
          askedAt.current = now;
          return "asking";
        }
        if (s === "asking" && now - askedAt.current > IDLE_PAUSE_AFTER_ASK_MS) return "paused";
        return s;
      });
    }, 2000);
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return { state: enabled ? state : ("active" as IdleState), resume };
}
