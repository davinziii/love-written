import { NextResponse } from "next/server";
import { z } from "zod";
import { Errors, route } from "@/lib/errors";
import { isManualPayments } from "@/lib/payments/mode";
import { clientIp, ipKey, readJson } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { createDraft } from "@/lib/surprises/repo";
import { track } from "@/lib/analytics/server";
import { log } from "@/lib/log";

const body = z.object({
  templateId: z.string().min(1).max(64),
  turnstileToken: z.string().max(4096).optional(),
});

/** Create a draft. Returns the edit token and recovery code exactly once. */
export const POST = route("create_draft", async (req: Request) => {
  // Manual workflow: surprises are created by the admin after payment is confirmed.
  if (isManualPayments) throw Errors.manualOrdersOnly();
  const input = await readJson(req, body);
  await enforceRateLimit("createDraft", ipKey(req.headers));
  await verifyTurnstile(input.turnstileToken, clientIp(req.headers));

  const { row, editToken, recoveryCode } = await createDraft(input.templateId);
  log.info("draft_created", { surpriseId: row.id, templateId: row.template_id });
  await track("customization_started", { templateId: row.template_id, surpriseId: row.id });

  return NextResponse.json({ surpriseId: row.id, templateId: row.template_id, editToken, recoveryCode }, { status: 201 });
});
