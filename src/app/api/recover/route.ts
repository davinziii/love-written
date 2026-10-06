import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, route } from "@/lib/errors";
import { log } from "@/lib/log";
import { clientIp, ipKey, readJson } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { redeemRecoveryCode } from "@/lib/surprises/repo";
import { track } from "@/lib/analytics/server";

const body = z.object({
  code: z.string().min(1).max(40),
  turnstileToken: z.string().max(4096).optional(),
});

/**
 * Find My Surprise. Strictly rate limited (per IP and globally). Returns only what the
 * browser needs to continue — no customer content.
 */
export const POST = route("recover", async (req: Request) => {
  await enforceRateLimit("recover", ipKey(req.headers));
  await enforceRateLimit("recoverGlobal", "all");
  const input = await readJson(req, body);
  await verifyTurnstile(input.turnstileToken, clientIp(req.headers));

  const result = await redeemRecoveryCode(input.code);
  if (!result) {
    log.warn("recovery_failed");
    throw new ApiError(404, "NOT_FOUND", "We couldn't find a surprise with that code. Check it and try again.");
  }
  log.info("recovery_succeeded", { surpriseId: result.surpriseId });
  await track("recovered", { templateId: result.templateId, surpriseId: result.surpriseId });
  return NextResponse.json(result);
});
