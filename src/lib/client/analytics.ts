"use client";

import type { ClientEvent } from "@/lib/analytics/events";

/** Fire-and-forget funnel event. Never blocks or errors the UI. */
export function trackClient(name: ClientEvent, templateId?: string) {
  try {
    const body = JSON.stringify({ name, templateId });
    if (navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } });
  } catch {
    // ignore
  }
}
