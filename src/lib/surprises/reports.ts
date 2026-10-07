import "server-only";
import { db } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import { log } from "@/lib/log";
import { UNIQUE_VIOLATION, type ReportRow, type SurpriseRow } from "@/lib/db-types";
import { generateReportCode } from "@/lib/security/tokens";
import { latestPublishOperation, paidOrderWithPayment } from "./repo";
import { alert } from "@/lib/alerts";

/**
 * "Report This Problem" for a paid surprise whose publishing failed.
 * The report links the exact order, payment, PayMongo reference and failed operation —
 * never matched by timestamp. One report per failed operation (idempotent).
 */
export async function createFailedPublishReport(
  row: SurpriseRow,
  idempotencyKey: string,
  customerMessage: string | undefined,
): Promise<{ reportCode: string }> {
  const sameKey = await reportBy("idempotency_key", idempotencyKey, row.id);
  if (sameKey) return { reportCode: sameKey.report_code };

  const op = await latestPublishOperation(row.id);
  if (row.stage !== "PUBLISH_FAILED" || !op || op.status !== "FAILED") {
    throw Errors.conflict("NOTHING_TO_REPORT", "There's no failed publish to report right now.");
  }
  const existing = await reportBy("publish_operation_id", op.id, row.id);
  if (existing) return { reportCode: existing.report_code };

  const paid = await paidOrderWithPayment(row.id);
  for (let attempt = 0; attempt < 3; attempt++) {
    const reportCode = generateReportCode();
    const { error } = await db()
      .from("reports")
      .insert({
        report_code: reportCode,
        surprise_id: row.id,
        order_id: paid?.order.id ?? null,
        payment_id: paid?.payment?.id ?? null,
        provider_reference: paid?.payment?.provider_payment_id ?? paid?.order.checkout_session_id ?? null,
        publish_operation_id: op.id,
        idempotency_key: idempotencyKey,
        error_code: op.error_code,
        error_message: op.error_message,
        customer_message: customerMessage?.trim().slice(0, 1000) || null,
      });
    if (!error) {
      log.info("report_created", { surpriseId: row.id, reportCode, operationId: op.id });
      alert("failed_publish_report", { "Report": reportCode, "Order": paid?.order.order_number, "Reason": op.error_code ?? undefined });
      return { reportCode };
    }
    if (error.code !== UNIQUE_VIOLATION) throw new Error(`create report: ${error.message}`);
    // Lost a race on the same operation/key → return the winner; otherwise a code collision → retry.
    const winner = (await reportBy("publish_operation_id", op.id, row.id)) ?? (await reportBy("idempotency_key", idempotencyKey, row.id));
    if (winner) return { reportCode: winner.report_code };
  }
  throw new Error("create report: could not allocate code");
}

async function reportBy(column: "idempotency_key" | "publish_operation_id", value: string, surpriseId: string) {
  const { data } = await db().from("reports").select("*").eq("surprise_id", surpriseId).eq(column, value).maybeSingle();
  return data as ReportRow | null;
}
