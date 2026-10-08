"use client";

import type { SignedPhoto } from "./types";

/**
 * The server signs photo links on every state read; using a fresh link each time would make
 * the browser re-download (and flicker) every image every second or two. Keep the first link
 * per photo (by its stable key) until it's close to expiring (links last 1 hour).
 */
const cache = new Map<string, { url: string; at: number }>();
const REUSE_MS = 45 * 60_000;

export function stableUrl(photo: SignedPhoto): string {
  const hit = cache.get(photo.key);
  if (hit && Date.now() - hit.at < REUSE_MS) return hit.url;
  if (photo.url) cache.set(photo.key, { url: photo.url, at: Date.now() });
  return photo.url;
}
