import { describe, expect, it } from "vitest";
import {
  EDIT_TOKEN_PATTERN,
  PUBLIC_TOKEN_PATTERN,
  generateOrderNumber,
  generateRecoveryCode,
  generateReportCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  randomToken,
  safeEqual,
} from "@/lib/security/tokens";
import { computeSignature, parseSignatureHeader, verifyPaymongoSignature } from "@/lib/payments/signature";
import { detectImageKind } from "@/lib/media/sniff";

describe("tokens", () => {
  it("public/edit tokens are 256-bit base64url and unique", () => {
    const tokens = new Set(Array.from({ length: 2000 }, () => randomToken()));
    expect(tokens.size).toBe(2000);
    for (const t of tokens) {
      expect(t).toMatch(PUBLIC_TOKEN_PATTERN);
      expect(t).toMatch(EDIT_TOKEN_PATTERN);
    }
  });

  it("rejects predictable / malformed public tokens", () => {
    for (const bad of ["1", "2", "abc", "../etc/passwd", "x".repeat(44), "x".repeat(42) + "="]) {
      expect(PUBLIC_TOKEN_PATTERN.test(bad)).toBe(false);
    }
  });

  it("recovery codes round-trip through normalization, forgiving typos", () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normalizeRecoveryCode(code.toLowerCase().replaceAll("-", " "))).toBe(code.replaceAll("-", ""));
    expect(normalizeRecoveryCode("O0IL-1111-2222")).toBe("00111111" + "2222");
    expect(normalizeRecoveryCode("SHORT")).toBeNull();
    expect(normalizeRecoveryCode("UUUU-UUUU-UUUU")).toBeNull();
  });

  it("recovery hashes depend on the pepper", () => {
    expect(hashRecoveryCode("pepper-a", "ABCDABCDABCD")).not.toBe(hashRecoveryCode("pepper-b", "ABCDABCDABCD"));
    expect(hashRecoveryCode("p", "ABCDABCDABCD")).toBe(hashRecoveryCode("p", "ABCDABCDABCD"));
  });

  it("report and order codes have the documented shape", () => {
    expect(generateReportCode()).toMatch(/^RPT-[0-9A-Z]{5}-[0-9A-Z]{4}$/);
    expect(generateOrderNumber(new Date("2026-10-06T10:00:00Z"))).toMatch(/^LW-20261006-[0-9A-Z]{5}$/);
  });

  it("safeEqual compares exactly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("PayMongo webhook signature", () => {
  const secret = "whsk_test_secret";
  const body = JSON.stringify({ data: { id: "evt_1", attributes: { type: "checkout_session.payment.paid" } } });
  const t = "1730000000";
  const sig = computeSignature(secret, t, body);

  it("accepts the test-mode signature in test mode", () => {
    const header = `t=${t},te=${sig},li=`;
    expect(verifyPaymongoSignature({ header, rawBody: body, secret, mode: "test" })).toBe(true);
    expect(verifyPaymongoSignature({ header, rawBody: body, secret, mode: "live" })).toBe(false);
  });

  it("accepts the live signature only in live mode", () => {
    const header = `t=${t},te=,li=${sig}`;
    expect(verifyPaymongoSignature({ header, rawBody: body, secret, mode: "live" })).toBe(true);
    expect(verifyPaymongoSignature({ header, rawBody: body, secret, mode: "test" })).toBe(false);
  });

  it("rejects a tampered body, wrong secret, or wrong timestamp", () => {
    const header = `t=${t},te=${sig},li=`;
    expect(verifyPaymongoSignature({ header, rawBody: body.replace("evt_1", "evt_2"), secret, mode: "test" })).toBe(false);
    expect(verifyPaymongoSignature({ header, rawBody: body, secret: "other", mode: "test" })).toBe(false);
    expect(verifyPaymongoSignature({ header: `t=1,te=${sig},li=`, rawBody: body, secret, mode: "test" })).toBe(false);
  });

  it("rejects missing or malformed headers", () => {
    expect(parseSignatureHeader(null)).toBeNull();
    expect(parseSignatureHeader("garbage")).toBeNull();
    expect(verifyPaymongoSignature({ header: "t=abc,te=zz", rawBody: body, secret, mode: "test" })).toBe(false);
  });
});

describe("image sniffing ignores the claimed type", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  it("detects real images", () => {
    expect(detectImageKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(detectImageKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(detectImageKind(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("webp");
  });
  it("rejects HTML, scripts, archives and executables", () => {
    for (const s of ["<html><script>", "<?xml version", "PK\u0003\u0004zipzipzip", "MZ\u0090\u0000exe-----", "GIF89a-------"]) {
      expect(detectImageKind(new TextEncoder().encode(s))).toBeNull();
    }
  });
});
