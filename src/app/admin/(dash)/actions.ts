"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/supabase/admin";
import { log, errorMessage } from "@/lib/log";
import { ApiError } from "@/lib/errors";
import { getSurprise } from "@/lib/surprises/repo";
import { publishSurprise, retryModeFor } from "@/lib/surprises/publish";
import { enqueueCleanup, runCleanupJob } from "@/lib/cleanup";
import { createManualOrder, reissueAccess, MANUAL_PAYMENT_CHANNELS, type IssuedAccess } from "@/lib/payments/manual";

/**
 * Narrow, audited admin actions. Each one re-checks admin authorization on the server.
 * There is deliberately no generic "run a query" capability.
 */
export interface ActionResult {
  ok: boolean;
  message: string;
}

const id = z.string().uuid();

function fail(err: unknown): ActionResult {
  return { ok: false, message: err instanceof ApiError ? err.userMessage : errorMessage(err) };
}

export async function retryPublishAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    const surpriseId = id.parse(form.get("surpriseId"));
    const row = await getSurprise(surpriseId);
    if (!row) return { ok: false, message: "Surprise not found" };
    if (row.payment_status !== "PAID") return { ok: false, message: "Not paid — nothing to retry" };
    const { mode, scheduledFor } = retryModeFor(row);
    log.info("admin_retry_publish", { adminId: admin.id, surpriseId, mode });
    // No charge is involved: publishing only ever reads the existing PAID order.
    const result = await publishSurprise({ surpriseId, idempotencyKey: randomUUID(), mode, scheduledFor, source: "admin" });
    revalidatePath("/admin", "layout");
    return result.status === "SUCCEEDED"
      ? { ok: true, message: mode === "schedule" ? "Re-scheduled successfully" : "Published successfully" }
      : { ok: false, message: `Publish ${result.status.toLowerCase()}${"errorCode" in result ? `: ${result.errorCode}` : ""}` };
  } catch (err) {
    return fail(err);
  }
}

export async function retryCleanupAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    const jobId = id.parse(form.get("jobId"));
    log.info("admin_retry_cleanup", { adminId: admin.id, jobId });
    const outcome = await runCleanupJob(jobId, { force: true });
    revalidatePath("/admin", "layout");
    if (!outcome) return { ok: false, message: "Job is not in a retryable state" };
    return outcome.ok ? { ok: true, message: "Deleted and verified" } : { ok: false, message: outcome.error ?? "Cleanup failed" };
  } catch (err) {
    return fail(err);
  }
}

export async function disableSurpriseAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    const surpriseId = id.parse(form.get("surpriseId"));
    const reason = z.string().trim().min(3).max(300).parse(form.get("reason"));
    const { data, error } = await db()
      .from("surprises")
      .update({ stage: "DISABLED", disabled_at: new Date().toISOString(), disabled_reason: reason })
      .eq("id", surpriseId)
      .not("stage", "in", "(DELETED,DISABLED)")
      .select("id");
    if (error) throw new Error(error.message);
    log.warn("admin_disabled_surprise", { adminId: admin.id, surpriseId });
    revalidatePath("/admin", "layout");
    return data?.length ? { ok: true, message: "Surprise disabled" } : { ok: false, message: "Already disabled or deleted" };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteNowAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    const surpriseId = id.parse(form.get("surpriseId"));
    if (form.get("confirm") !== "DELETE") return { ok: false, message: 'Type DELETE to confirm' };
    // Leave PUBLISHED first so the database allows media deletion.
    await db().from("surprises").update({ stage: "EXPIRED" }).eq("id", surpriseId).in("stage", ["PUBLISHED", "SCHEDULED"]);
    await enqueueCleanup(surpriseId, "admin");
    const { data: job } = await db().from("cleanup_jobs").select("id").eq("surprise_id", surpriseId).single();
    log.warn("admin_delete_now", { adminId: admin.id, surpriseId });
    const outcome = job ? await runCleanupJob(job.id as string, { force: true }) : null;
    revalidatePath("/admin", "layout");
    if (!outcome) return { ok: false, message: "Cleanup job could not start" };
    return outcome.ok ? { ok: true, message: "Deleted and verified" } : { ok: false, message: outcome.error ?? "Cleanup failed" };
  } catch (err) {
    return fail(err);
  }
}

/* ─── Manual payment workflow ──────────────────────────────────────────────── */

export interface IssueResult extends ActionResult {
  access?: IssuedAccess;
}

const manualOrderSchema = z.object({
  templateId: z.string().min(1).max(64),
  amountPesos: z.coerce.number().positive().max(100_000),
  channel: z.enum(MANUAL_PAYMENT_CHANNELS),
  paymentReference: z.string().trim().max(120).optional(),
  customerLabel: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().uuid(),
  confirmPaid: z.literal("yes"),
});

/** Admin confirmed a manual payment → create the surprise + PAID order + private link. */
export async function createManualOrderAction(_prev: IssueResult | null, form: FormData): Promise<IssueResult> {
  const admin = await requireAdmin();
  const parsed = manualOrderSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      message:
        first?.path[0] === "confirmPaid"
          ? "Tick the box to confirm you've received the payment."
          : `Check the ${String(first?.path[0] ?? "form")} field.`,
    };
  }
  try {
    const access = await createManualOrder(
      {
        templateId: parsed.data.templateId,
        amountCentavos: Math.round(parsed.data.amountPesos * 100),
        channel: parsed.data.channel,
        paymentReference: parsed.data.paymentReference,
        customerLabel: parsed.data.customerLabel,
        notes: parsed.data.notes,
        idempotencyKey: parsed.data.idempotencyKey,
      },
      admin.id,
    );
    revalidatePath("/admin", "layout");
    if (access.replayed && !access.customizationLink) {
      return { ok: true, message: `Order ${access.orderNumber} was already created and the customer has started — use "New link" on its page if needed.`, access };
    }
    return { ok: true, message: `Order ${access.orderNumber} created`, access };
  } catch (err) {
    return fail(err);
  }
}

/** Issue a fresh private link + recovery code (old ones stop working). */
export async function reissueAccessAction(_prev: IssueResult | null, form: FormData): Promise<IssueResult> {
  const admin = await requireAdmin();
  try {
    const surpriseId = id.parse(form.get("surpriseId"));
    const access = await reissueAccess(surpriseId, admin.id);
    return { ok: true, message: "New link issued — the previous link and recovery code no longer work.", access };
  } catch (err) {
    return fail(err);
  }
}

export async function resolveReportAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    const reportId = id.parse(form.get("reportId"));
    await db().from("reports").update({ status: "RESOLVED", resolved_at: new Date().toISOString() }).eq("id", reportId);
    log.info("admin_resolved_report", { adminId: admin.id, reportId });
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Marked resolved" };
  } catch (err) {
    return fail(err);
  }
}
