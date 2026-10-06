import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * PayMongo webhook signature verification (pure, unit-tested).
 *
 * Per PayMongo's "Securing a webhook" docs, the `Paymongo-Signature` header is
 *   t=<timestamp>,te=<test-mode signature>,li=<live-mode signature>
 * and the signature is HMAC-SHA256(webhook secret, `${t}.${rawBody}`) as hex.
 * Compare against `li` in live mode and `te` in test mode.
 */
export interface ParsedSignature {
  timestamp: string;
  test: string;
  live: string;
}

export function parseSignatureHeader(header: string | null): ParsedSignature | null {
  if (!header) return null;
  const parts: Record<string, string> = {};
  for (const piece of header.split(",")) {
    const idx = piece.indexOf("=");
    if (idx > 0) parts[piece.slice(0, idx).trim()] = piece.slice(idx + 1).trim();
  }
  if (!parts.t || !/^\d+$/.test(parts.t)) return null;
  return { timestamp: parts.t, test: parts.te ?? "", live: parts.li ?? "" };
}

export function computeSignature(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

export function verifyPaymongoSignature(opts: {
  header: string | null;
  rawBody: string;
  secret: string;
  mode: "test" | "live";
}): boolean {
  const parsed = parseSignatureHeader(opts.header);
  if (!parsed) return false;
  const provided = opts.mode === "live" ? parsed.live : parsed.test;
  if (!/^[0-9a-f]{64}$/i.test(provided)) return false;
  const expected = computeSignature(opts.secret, parsed.timestamp, opts.rawBody);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided.toLowerCase(), "hex"));
}
