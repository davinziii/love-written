import "server-only";
import { db } from "@/lib/supabase/admin";
import { env, isProduction } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { log, errorMessage } from "@/lib/log";
import { track } from "@/lib/analytics/server";
import { UNIQUE_VIOLATION, type PublishOperationRow, type SurpriseRow } from "@/lib/db-types";
import { canPublish, expiryFrom, PUBLISHABLE_STAGES, validateScheduleTime } from "@/lib/lifecycle";
import { randomToken } from "@/lib/security/tokens";
import { listSurpriseObjects } from "@/lib/media/storage";
import { alert } from "@/lib/alerts";
import { getTemplate } from "@/templates";
import { validateCustomerData } from "@/templates/schema";
import { customerData, getMedia, getSurprise, mediaFieldSet } from "./repo";

/**
 * Publishing — one function used by the customer ("Publish" / "Schedule" / "Try again"),
 * the admin ("Retry publish") and the scheduler (reveal time reached).
 *
 * Guarantees:
 *  • Idempotent: the same (surprise, idempotency key) always returns the same operation.
 *  • One operation in flight per surprise (partial unique index in the database).
 *  • State changes are compare-and-set, so a double click cannot publish twice.
 *  • Failure never touches payment: the surprise moves to PUBLISH_FAILED and stays PAID.
 */

export type PublishMode = "now" | "schedule" | "activate";

export interface PublishRequest {
  surpriseId: string;
  idempotencyKey: string;
  mode: PublishMode;
  scheduledFor?: Date;
  source: "customer" | "admin" | "scheduler";
}

export type PublishResult =
  | { status: "SUCCEEDED"; operationId: string }
  | { status: "FAILED"; operationId: string; errorCode: string }
  | { status: "RUNNING"; operationId: string };

/** A RUNNING operation older than this is assumed dead (e.g. function timeout). */
const STALE_OPERATION_MS = 2 * 60_000;

class PublishError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function resultOf(op: PublishOperationRow): PublishResult {
  if (op.status === "SUCCEEDED") return { status: "SUCCEEDED", operationId: op.id };
  if (op.status === "FAILED") return { status: "FAILED", operationId: op.id, errorCode: op.error_code ?? "UNKNOWN" };
  return { status: "RUNNING", operationId: op.id };
}

async function findOperation(surpriseId: string, key: string): Promise<PublishOperationRow | null> {
  const { data, error } = await db()
    .from("publish_operations")
    .select("*")
    .eq("surprise_id", surpriseId)
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw new Error(`load op: ${error.message}`);
  return data as PublishOperationRow | null;
}

export async function failStaleOperations(surpriseId?: string): Promise<void> {
  let q = db()
    .from("publish_operations")
    .update({
      status: "FAILED",
      error_code: "TIMEOUT",
      error_message: "Operation did not finish in time",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "RUNNING")
    .lt("started_at", new Date(Date.now() - STALE_OPERATION_MS).toISOString());
  if (surpriseId) q = q.eq("surprise_id", surpriseId);
  const { error } = await q;
  if (error) log.error("stale_op_cleanup_failed", { error: error.message });
}

/** How an admin retry (or scheduler) should publish a surprise that failed earlier. */
export function retryModeFor(row: SurpriseRow, now = new Date()): { mode: PublishMode; scheduledFor?: Date } {
  if (row.reveal_mode === "schedule" && row.scheduled_for && new Date(row.scheduled_for).getTime() > now.getTime() + 60_000) {
    return { mode: "schedule", scheduledFor: new Date(row.scheduled_for) };
  }
  return { mode: "now" };
}

/** Customer-facing checks that should produce a validation message, not a failed operation. */
export async function assertPublishable(row: SurpriseRow, mode: PublishMode, scheduledFor?: Date) {
  if (!canPublish(row.stage, row.payment_status)) {
    if (row.stage === "PUBLISHED") throw Errors.conflict("ALREADY_PUBLISHED", "Your surprise is already live.");
    throw Errors.conflict("NOT_PUBLISHABLE", "This surprise isn't ready to publish yet.");
  }
  if (mode === "schedule") {
    const check = validateScheduleTime(scheduledFor ?? new Date(NaN));
    if (!check.ok) throw Errors.validation({ scheduledFor: check.message });
  }
  const template = getTemplate(row.template_id);
  if (!template) throw Errors.conflict("NOT_PUBLISHABLE", "This surprise's template is no longer available.");
  const media = await getMedia(row.id);
  const result = validateCustomerData(template, customerData(row), {
    mode: "strict",
    imageFieldsPresent: mediaFieldSet(media),
  });
  if (!result.ok) throw Errors.validation(result.errors);
}

export async function publishSurprise(req: PublishRequest): Promise<PublishResult> {
  const replay = await findOperation(req.surpriseId, req.idempotencyKey);
  if (replay) return resultOf(replay);

  const row = await getSurprise(req.surpriseId);
  if (!row) throw Errors.notFound();
  if (!canPublish(row.stage, row.payment_status)) {
    if (row.stage === "PUBLISHED") throw Errors.conflict("ALREADY_PUBLISHED", "Your surprise is already live.");
    throw Errors.conflict("NOT_PUBLISHABLE", "This surprise isn't ready to publish yet.");
  }

  await failStaleOperations(row.id);

  // Claim the operation. The unique indexes reject duplicates and concurrent attempts.
  const { data: inserted, error: insertError } = await db()
    .from("publish_operations")
    .insert({
      surprise_id: row.id,
      idempotency_key: req.idempotencyKey,
      mode: req.mode,
      source: req.source,
      scheduled_for: req.mode === "schedule" ? req.scheduledFor?.toISOString() : null,
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) {
      const same = await findOperation(row.id, req.idempotencyKey);
      if (same) return resultOf(same);
      throw Errors.conflict("IN_PROGRESS", "Your surprise is already being published. One moment…");
    }
    throw new Error(`claim op: ${insertError.message}`);
  }
  const op = inserted as PublishOperationRow;
  log.info("publish_started", { surpriseId: row.id, operationId: op.id, mode: req.mode, source: req.source });

  try {
    await execute(row, req);
    await db()
      .from("publish_operations")
      .update({ status: "SUCCEEDED", finished_at: new Date().toISOString() })
      .eq("id", op.id);
    log.info("publish_succeeded", { surpriseId: row.id, operationId: op.id, mode: req.mode });
    await track(req.mode === "schedule" ? "scheduled" : "published", {
      templateId: row.template_id,
      surpriseId: row.id,
    });
    return { status: "SUCCEEDED", operationId: op.id };
  } catch (err) {
    const code = err instanceof PublishError ? err.code : "INTERNAL";
    const message = errorMessage(err);
    await db()
      .from("publish_operations")
      .update({ status: "FAILED", error_code: code, error_message: message, finished_at: new Date().toISOString() })
      .eq("id", op.id);
    // Payment is untouched — only the publishing state changes.
    await db()
      .from("surprises")
      .update({ stage: "PUBLISH_FAILED" })
      .eq("id", row.id)
      .in("stage", PUBLISHABLE_STAGES as string[])
      .is("locked_at", null);
    log.error("publish_failed", { surpriseId: row.id, operationId: op.id, code, error: message });
    alert("publish_failed", { "Surprise": row.id, "Operation": op.id, "Reason": code, "Started by": req.source });
    await track("publish_failed", { templateId: row.template_id, surpriseId: row.id });
    return { status: "FAILED", operationId: op.id, errorCode: code };
  }
}

async function execute(row: SurpriseRow, req: PublishRequest): Promise<void> {
  if (!isProduction && env().LW_FAULT_INJECT_PUBLISH === "1") {
    throw new PublishError("FAULT_INJECTED", "Simulated failure (LW_FAULT_INJECT_PUBLISH=1)");
  }

  const template = getTemplate(row.template_id);
  if (!template) throw new PublishError("UNKNOWN_TEMPLATE", `Template ${row.template_id} is not registered`);

  // 1. Content must be complete and valid.
  const media = await getMedia(row.id);
  const validation = validateCustomerData(template, customerData(row), {
    mode: "strict",
    imageFieldsPresent: mediaFieldSet(media),
  });
  if (!validation.ok) {
    throw new PublishError("INVALID_CONTENT", `Invalid fields: ${Object.keys(validation.errors).join(", ")}`);
  }

  // 2. Every referenced photo must really exist in storage.
  let stored: Set<string>;
  try {
    stored = new Set(await listSurpriseObjects(row.id));
  } catch (err) {
    throw new PublishError("STORAGE_UNAVAILABLE", errorMessage(err));
  }
  const missing = media.filter((m) => !stored.has(m.storage_path));
  if (missing.length > 0) {
    throw new PublishError("MEDIA_MISSING", `Missing objects for fields: ${missing.map((m) => m.field_id).join(", ")}`);
  }

  // 3. Compare-and-set the lifecycle transition.
  const now = new Date();
  const publicToken = row.public_token ?? randomToken();
  let update: Record<string, unknown>;
  let fromStages: string[] = PUBLISHABLE_STAGES as string[];

  if (req.mode === "schedule") {
    const at = req.scheduledFor!;
    update = { stage: "SCHEDULED", reveal_mode: "schedule", scheduled_for: at.toISOString(), public_token: publicToken };
  } else if (req.mode === "activate") {
    // Reveal time reached: the 30 days start at the scheduled reveal moment.
    const revealAt = row.scheduled_for ? new Date(row.scheduled_for) : now;
    const liveAt = revealAt <= now ? revealAt : now;
    update = {
      stage: "PUBLISHED",
      public_token: publicToken,
      locked_at: now.toISOString(),
      published_at: liveAt.toISOString(),
      expires_at: expiryFrom(liveAt).toISOString(),
    };
    fromStages = ["SCHEDULED"];
  } else {
    update = {
      stage: "PUBLISHED",
      reveal_mode: "now",
      public_token: publicToken,
      locked_at: now.toISOString(),
      published_at: now.toISOString(),
      expires_at: expiryFrom(now).toISOString(),
    };
  }

  let q = db()
    .from("surprises")
    .update(update)
    .eq("id", row.id)
    .eq("payment_status", "PAID")
    .in("stage", fromStages)
    .is("locked_at", null);
  if (req.mode === "activate") q = q.lte("scheduled_for", now.toISOString());

  const { data, error } = await q.select("id");
  if (error) throw new PublishError("DATABASE_ERROR", error.message);
  if (!data || data.length !== 1) throw new PublishError("STATE_CHANGED", "Surprise changed state during publish");
}
