import { NextResponse } from "next/server";
import { z } from "zod";
import { Errors, route } from "@/lib/errors";
import { isManualPayments } from "@/lib/payments/mode";
import { clientIp, idempotencyKeySchema, ipKey, readJson } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { createPendingBooth, startBoothCheckout } from "@/lib/photobooth/payments";
import { db } from "@/lib/supabase/admin";
import type { PhotoboothSessionRow } from "@/lib/db-types";

const body = z.object({
  createKey: idempotencyKeySchema,
  turnstileToken: z.string().max(4096).optional(),
});

/**
 * Self-serve: create a photobooth for Person A and open PayMongo checkout.
 * Returns Person A's private link token once (also recoverable from the same createKey).
 */
export const POST = route("photobooth_create", async (req: Request) => {
  if (isManualPayments) throw Errors.manualOrdersOnly();
  const input = await readJson(req, body);
  await enforceRateLimit("boothCreate", ipKey(req.headers));
  await verifyTurnstile(input.turnstileToken, clientIp(req.headers));

  const { sessionId, token } = await createPendingBooth(input.createKey);
  const { data } = await db().from("photobooth_sessions").select("*").eq("id", sessionId).single();
  const checkout = await startBoothCheckout(data as PhotoboothSessionRow, input.createKey);
  return NextResponse.json(
    { sessionId, token, checkoutUrl: checkout.kind === "redirect" ? checkout.checkoutUrl : null },
    { status: 201 },
  );
});
