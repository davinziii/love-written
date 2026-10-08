"use client";

import { api } from "@/lib/client/api";

/**
 * Browser-side helpers for a photobooth participant.
 * The private token comes from the link fragment (#k=…) and is remembered on this device,
 * so closing the tab and coming back later just works.
 */

const TOKEN_KEY = (sessionId: string) => `lw:booth:${sessionId}`;
const DEVICE_KEY = "lw:booth-device";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Token from the link (preferred) or from this device. The link is left as-is so "Open in browser" keeps working. */
export function readBoothToken(sessionId: string): string | null {
  const fromLink = new URLSearchParams(window.location.hash.slice(1)).get("k");
  if (fromLink && TOKEN_PATTERN.test(fromLink)) {
    storage()?.setItem(TOKEN_KEY(sessionId), fromLink);
    return fromLink;
  }
  const saved = storage()?.getItem(TOKEN_KEY(sessionId));
  return saved && TOKEN_PATTERN.test(saved) ? saved : null;
}

export function rememberBoothToken(sessionId: string, token: string) {
  storage()?.setItem(TOKEN_KEY(sessionId), token);
}

/** A random id for this browser, so one link can't be used on two devices at once. */
export function deviceId(): string {
  const s = storage();
  let id = s?.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    s?.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** This person's own private link (to reopen later or on another device). */
export function ownLink(sessionId: string, token: string): string {
  return `${window.location.origin}/photobooth/s/${sessionId}#k=${token}`;
}

export function boothApi<T>(
  sessionId: string,
  token: string,
  path: string,
  opts: { method?: string; body?: unknown; retries?: number } = {},
): Promise<T> {
  return api<T>(`/api/photobooth/${sessionId}${path}`, {
    ...opts,
    headers: { "x-lw-booth-token": token, "x-lw-booth-device": deviceId() },
  });
}

/** Copy text, with a fallback for older in-app browsers. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
}
