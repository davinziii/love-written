"use client";

import type { ApiErrorBody } from "@/lib/studio-types";

export class ClientApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

const FRIENDLY_NETWORK_ERROR =
  "We couldn't reach Love, Written. Check your connection — your work has not been lost.";

/** Waits before retry n (1-based): ~0.8s, then ~2s — long enough for a signal blip to pass. */
const RETRY_DELAYS_MS = [800, 2000, 4000];

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/**
 * JSON fetch with the edit token header and friendly errors.
 *
 * `retries`: how many more times to try when the request never got an answer (connection
 * dropped — common on mobile data and inside in-app browsers like Messenger). Only use it
 * for requests that are safe to repeat. GET requests retry twice by default.
 */
export async function api<T>(
  path: string,
  {
    method = "GET",
    body,
    editToken,
    signal,
    retries = method === "GET" ? 2 : 0,
    headers: extraHeaders,
  }: { method?: string; body?: unknown; editToken?: string; signal?: AbortSignal; retries?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  let res: Response | undefined;
  for (let attempt = 0; !res; attempt++) {
    try {
      res = await fetch(path, {
        method,
        signal,
        cache: "no-store",
        headers: {
          ...(body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : {}),
          ...(editToken ? { "x-lw-edit-token": editToken } : {}),
          ...extraHeaders,
        },
        body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (attempt >= retries) throw new ClientApiError(0, "NETWORK", FRIENDLY_NETWORK_ERROR);
      await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!, signal);
    }
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    const e = data?.error;
    throw new ClientApiError(
      res.status,
      e?.code ?? "INTERNAL",
      e?.message ?? "Something went wrong. Your work has not been lost. Please try again.",
      e?.fields,
    );
  }
  return data as T;
}

/** A fresh idempotency key for one user intent (reuse it when retrying that same intent). */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
