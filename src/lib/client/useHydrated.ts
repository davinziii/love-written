"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * false during server render and hydration, true afterwards. Use it to read browser-only
 * values (localStorage, the current time, time zones) without hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
