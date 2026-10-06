import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Credential generation and hashing. Pure functions (pepper passed in) so they are unit-testable.
 *
 *   public token   — 256-bit, URL of the published surprise (viewing only)
 *   edit token     — 256-bit, kept in the customer's browser, stored hashed (SHA-256)
 *   recovery code  — 60-bit human-typeable code, stored as HMAC(pepper), rate limited
 */

// Crockford base32: no I, L, O, U — easy to read aloud and type.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const EDIT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const RECOVERY_CODE_LENGTH = 12;

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Uniformly random Crockford characters (32 divides 256, so `byte & 31` is unbiased). */
export function randomCrockford(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += CROCKFORD[bytes[i]! & 31];
  return out;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hmacHex(pepper: string, value: string): string {
  return createHmac("sha256", pepper).update(value, "utf8").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** e.g. "8F4K-2M91-XQ7P" */
export function generateRecoveryCode(): string {
  const raw = randomCrockford(RECOVERY_CODE_LENGTH);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/** Normalizes what a person typed; returns null if it cannot be a recovery code. */
export function normalizeRecoveryCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== RECOVERY_CODE_LENGTH) return null;
  for (const ch of cleaned) if (!CROCKFORD.includes(ch)) return null;
  return cleaned;
}

export function hashRecoveryCode(pepper: string, normalizedCode: string): string {
  return hmacHex(pepper, `recovery:${normalizedCode}`);
}

/** e.g. "RPT-8F42K-31X8" */
export function generateReportCode(): string {
  const raw = randomCrockford(9);
  return `RPT-${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** e.g. "LW-20261006-8F42K" (date in Asia/Manila) */
export function generateOrderNumber(now: Date = new Date()): string {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");
  return `LW-${ymd}-${randomCrockford(5)}`;
}
