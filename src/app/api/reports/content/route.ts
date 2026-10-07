import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/errors";
import { clientIp, idempotencyKeySchema, ipKey, readJson } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { PUBLIC_TOKEN_PATTERN } from "@/lib/security/tokens";
import { createContentReport } from "@/lib/surprises/content-reports";
import { CONTENT_REPORT_REASONS, type ContentReportReason } from "@/lib/report-reasons";

const body = z.object({
  token: z.string().regex(PUBLIC_TOKEN_PATTERN),
  reason: z.enum(Object.keys(CONTENT_REPORT_REASONS) as [ContentReportReason, ...ContentReportReason[]]),
  details: z.string().max(1000).optional(),
  idempotencyKey: idempotencyKeySchema,
  turnstileToken: z.string().max(4096).optional(),
});

/** Recipient reports a surprise for abuse. Anonymous; rate limited per IP and per surprise. */
export const POST = route("content_report", async (req: Request) => {
  await enforceRateLimit("contentReport", ipKey(req.headers));
  const input = await readJson(req, body);
  await enforceRateLimit("contentReportPerSurprise", input.token.slice(0, 16));
  await verifyTurnstile(input.turnstileToken, clientIp(req.headers));
  const result = await createContentReport(input);
  return NextResponse.json(result, { status: 201 });
});
