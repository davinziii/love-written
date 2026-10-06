import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { hmacHex } from "./tokens";

export const EDIT_TOKEN_HEADER = "x-lw-edit-token";

/** Client IP: Cloudflare header first, then Vercel's forwarded headers. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Peppered hash so raw IPs are never stored (used only as rate-limit keys). */
export function ipKey(headers: Headers): string {
  return hmacHex(env().APP_HASH_PEPPER, `ip:${clientIp(headers)}`).slice(0, 32);
}

const MAX_JSON_BYTES = 64 * 1024;

/** Parse and validate a JSON body with a size cap. */
export async function readJson<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw Errors.badRequest("That request was too large.");
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw Errors.badRequest();
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw Errors.badRequest();
  return parsed.data;
}

export const uuidSchema = z.string().uuid();
/** Client-generated idempotency key (crypto.randomUUID()). */
export const idempotencyKeySchema = z.string().uuid();
