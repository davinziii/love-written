import "server-only";
import { db } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import { log } from "@/lib/log";
import { alert } from "@/lib/alerts";
import { UNIQUE_VIOLATION } from "@/lib/db-types";
import { generateReportCode } from "@/lib/security/tokens";
import { getSurpriseByPublicToken } from "./repo";
import { CONTENT_REPORT_REASONS, type ContentReportReason } from "@/lib/report-reasons";

/**
 * A recipient reports a published surprise. Creates a report the admin reviews (and can
 * disable the surprise from). The reporter stays anonymous: no IP or personal data stored.
 */
export async function createContentReport(input: {
  token: string;
  reason: ContentReportReason;
  details?: string;
  idempotencyKey: string;
}): Promise<{ reportCode: string }> {
  const surprise = await getSurpriseByPublicToken(input.token);
  if (!surprise || !["PUBLISHED", "SCHEDULED", "DISABLED"].includes(surprise.stage)) throw Errors.notFound();

  const { data: existing } = await db()
    .from("reports")
    .select("report_code")
    .eq("surprise_id", surprise.id)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) return { reportCode: existing.report_code as string };

  for (let attempt = 0; attempt < 3; attempt++) {
    const reportCode = generateReportCode();
    const { error } = await db().from("reports").insert({
      report_code: reportCode,
      surprise_id: surprise.id,
      kind: "content",
      reason: input.reason,
      idempotency_key: input.idempotencyKey,
      customer_message: input.details?.trim().slice(0, 1000) || null,
    });
    if (!error) {
      log.warn("content_report_created", { surpriseId: surprise.id, reportCode, reason: input.reason });
      alert("content_report", { Report: reportCode, Reason: CONTENT_REPORT_REASONS[input.reason], Surprise: surprise.id });
      return { reportCode };
    }
    if (error.code !== UNIQUE_VIOLATION) throw new Error(`content report: ${error.message}`);
  }
  throw new Error("content report: could not allocate code");
}
