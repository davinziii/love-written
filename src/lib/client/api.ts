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

/** JSON fetch with the edit token header and friendly errors. */
export async function api<T>(
  path: string,
  { method = "GET", body, editToken, signal }: { method?: string; body?: unknown; editToken?: string; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      signal,
      cache: "no-store",
      headers: {
        ...(body !== undefined && !(body instanceof FormData) ? { "content-type": "application/json" } : {}),
        ...(editToken ? { "x-lw-edit-token": editToken } : {}),
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ClientApiError(0, "NETWORK", FRIENDLY_NETWORK_ERROR);
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
