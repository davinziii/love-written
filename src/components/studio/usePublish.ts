"use client";

import { useCallback, useRef, useState } from "react";
import { api, ClientApiError, newIdempotencyKey } from "@/lib/client/api";
import type { Studio } from "./useStudio";

type PublishResponse =
  | { status: "SUCCEEDED"; operationId: string }
  | { status: "FAILED"; operationId: string; errorCode: string }
  | { status: "RUNNING"; operationId: string };

/**
 * Publish / schedule / retry. One idempotency key per user intent: if the network drops
 * and they click again, the same key is reused and the server returns the original result.
 */
export function usePublish(studio: Studio) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const key = useRef<string | null>(null);
  const inFlight = useRef(false);

  const publish = useCallback(
    async (mode: "now" | "schedule", scheduledFor: string | null): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      setFieldErrors({});
      key.current ??= newIdempotencyKey();
      try {
        await studio.flush();
        const res = await api<PublishResponse>(`/api/surprises/${studio.state!.id}/publish`, {
          method: "POST",
          editToken: studio.editToken() ?? undefined,
          body: { idempotencyKey: key.current, mode, scheduledFor: mode === "schedule" ? scheduledFor ?? undefined : undefined },
        });
        key.current = null; // definitive answer — the next click is a new intent
        if (res.status === "RUNNING") await waitForSettle(studio);
        await studio.refresh();
        return res.status === "SUCCEEDED";
      } catch (err) {
        if (err instanceof ClientApiError) {
          if (err.status !== 0) key.current = null; // only keep the key across network failures
          if (err.code === "IN_PROGRESS") {
            await waitForSettle(studio);
            await studio.refresh().catch(() => undefined);
            return false;
          }
          if (err.code === "ALREADY_PUBLISHED") {
            await studio.refresh().catch(() => undefined);
            return true;
          }
          if (err.fields) setFieldErrors(err.fields);
          setError(err.message);
        } else {
          setError("Something went wrong. Please try again.");
        }
        return false;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [studio],
  );

  return { publish, busy, error, fieldErrors, clearError: () => setError(null) };
}

async function waitForSettle(studio: Studio) {
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = await studio.refresh().catch(() => null);
    if (s && s.screen !== "finalize") return;
  }
}
