"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/errors";
import { log, errorMessage } from "@/lib/log";
import { MANUAL_PAYMENT_CHANNELS } from "@/lib/payments/manual";
import { createManualBooth, type IssuedBooth } from "@/lib/photobooth/payments";
import { retryFinalize } from "@/lib/photobooth/session";
import { deleteBooth } from "@/lib/photobooth/cleanup";
import type { PhotoboothSessionRow } from "@/lib/db-types";
import type { ActionResult } from "../actions";

const id = z.string().uuid();
const fail = (err: unknown): ActionResult => ({ ok: false, message: err instanceof ApiError ? err.userMessage : errorMessage(err) });

export interface BoothIssueResult extends ActionResult {
  booth?: IssuedBooth;
}

const manualSchema = z.object({
  amountPesos: z.coerce.number().positive().max(100_000),
  channel: z.enum(MANUAL_PAYMENT_CHANNELS),
  paymentReference: z.string().max(120).optional(),
  customerLabel: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().uuid(),
  confirmPaid: z.literal("yes"),
});

/** Manual workflow: payment received outside the site → create a PAID photobooth + both links. */
export async function createManualBoothAction(_prev: BoothIssueResult | null, form: FormData): Promise<BoothIssueResult> {
  const admin = await requireAdmin();
  const parsed = manualSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.path[0] === "confirmPaid" ? "Tick the box to confirm you've received the payment." : `Check the ${String(first?.path[0] ?? "form")} field.` };
  }
  try {
    const booth = await createManualBooth(
      {
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
    return { ok: true, message: `Photobooth ${booth.orderNumber} created`, booth };
  } catch (err) {
    return fail(err);
  }
}

/** Rebuild the strip after FINALIZATION_FAILED. No charge is involved. */
export async function retryBoothFinalizeAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    const sessionId = id.parse(form.get("sessionId"));
    log.info("admin_photobooth_retry_finalize", { adminId: admin.id, sessionId });
    await retryFinalize(sessionId);
    const { data } = await db().from("photobooth_sessions").select("status, generation_error").eq("id", sessionId).single();
    revalidatePath("/admin", "layout");
    return data?.status === "COMPLETED"
      ? { ok: true, message: "Strip generated — the customers can download it now" }
      : { ok: false, message: (data?.generation_error as string | null) ?? `Status is ${data?.status}` };
  } catch (err) {
    return fail(err);
  }
}

/** Delete photos + access now (expired sessions, cleanup retries, or a support request). */
export async function deleteBoothNowAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  try {
    const sessionId = id.parse(form.get("sessionId"));
    if (form.get("confirm") !== "DELETE") return { ok: false, message: 'Type "DELETE" to confirm' };
    const { data } = await db().from("photobooth_sessions").select("*").eq("id", sessionId).single();
    if (!data) return { ok: false, message: "Photobooth not found" };
    log.warn("admin_photobooth_delete", { adminId: admin.id, sessionId });
    await db().from("photobooth_sessions").update({ status: "EXPIRED", cleanup_reason: "admin" }).eq("id", sessionId).neq("status", "DELETED");
    const ok = await deleteBooth(data as PhotoboothSessionRow, { force: true });
    revalidatePath("/admin", "layout");
    return ok ? { ok: true, message: "Photos deleted and links disabled (verified)" } : { ok: false, message: "Deletion failed — see the error on this page and retry" };
  } catch (err) {
    return fail(err);
  }
}
