import "server-only";
import { env } from "@/lib/env";
import { Errors } from "@/lib/errors";

/**
 * Cloudflare Turnstile verification. Disabled when TURNSTILE_SECRET_KEY is not set,
 * so local development and the first launch work without it.
 */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<void> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) throw Errors.badRequest("Please complete the quick check and try again.");

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  const body = (await res?.json().catch(() => null)) as { success?: boolean } | null;
  if (!body?.success) throw Errors.badRequest("Please complete the quick check and try again.");
}
