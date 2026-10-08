import "server-only";
import { db } from "@/lib/supabase/admin";
import { log, errorMessage } from "@/lib/log";
import type { SurpriseRow } from "@/lib/db-types";
import { UNPUBLISHED_PAID_TTL_DAYS } from "@/lib/lifecycle";
import { enqueueCleanup, processDueCleanupJobs } from "@/lib/cleanup";
import { failStaleOperations, publishSurprise, type PublishResult } from "./publish";
import { runPhotoboothMaintenance } from "@/lib/photobooth/cleanup";

/**
 * Time-based transitions. Each runs both lazily (when a recipient opens the link) and
 * from the maintenance cron, so correctness does not depend on how often cron runs.
 */

/** Scheduler idempotency key: one activation per scheduled time. */
function activationKey(row: Pick<SurpriseRow, "id" | "scheduled_for">): string {
  return `activate:${row.scheduled_for}`;
}

export async function activateScheduled(row: Pick<SurpriseRow, "id" | "scheduled_for">): Promise<PublishResult> {
  return publishSurprise({
    surpriseId: row.id,
    idempotencyKey: activationKey(row),
    mode: "activate",
    source: "scheduler",
  });
}

/** PUBLISHED → EXPIRED (compare-and-set) and queue deletion. */
export async function expireSurprise(id: string): Promise<boolean> {
  const { data, error } = await db()
    .from("surprises")
    .update({ stage: "EXPIRED" })
    .eq("id", id)
    .eq("stage", "PUBLISHED")
    .lte("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw new Error(`expire: ${error.message}`);
  const changed = (data?.length ?? 0) > 0;
  if (changed) {
    await enqueueCleanup(id, "expired");
    log.info("surprise_expired", { surpriseId: id });
  }
  return changed;
}

export interface MaintenanceSummary {
  activated: number;
  activationFailures: number;
  expired: number;
  abandonedDrafts: number;
  idlePaidDeleted: number;
  cleanupSucceeded: number;
  cleanupFailed: number;
  photoboothExpired?: number;
  photoboothDeleted?: number;
  photoboothCleanupFailed?: number;
}

export async function runMaintenance(): Promise<MaintenanceSummary> {
  const now = new Date().toISOString();
  const summary: MaintenanceSummary = {
    activated: 0,
    activationFailures: 0,
    expired: 0,
    abandonedDrafts: 0,
    idlePaidDeleted: 0,
    cleanupSucceeded: 0,
    cleanupFailed: 0,
  };

  await failStaleOperations();

  // 1. Reveal scheduled surprises whose time has come.
  const { data: due } = await db()
    .from("surprises")
    .select("id, scheduled_for")
    .eq("stage", "SCHEDULED")
    .lte("scheduled_for", now)
    .limit(50);
  for (const row of due ?? []) {
    try {
      const r = await activateScheduled(row as Pick<SurpriseRow, "id" | "scheduled_for">);
      if (r.status === "SUCCEEDED") summary.activated++;
      else if (r.status === "FAILED") summary.activationFailures++;
    } catch (err) {
      summary.activationFailures++;
      log.error("activation_error", { surpriseId: row.id as string, error: errorMessage(err) });
    }
  }

  // 2. Expire surprises past their 30 days.
  const { data: expiring } = await db()
    .from("surprises")
    .select("id")
    .eq("stage", "PUBLISHED")
    .lte("expires_at", now)
    .limit(200);
  for (const row of expiring ?? []) {
    if (await expireSurprise(row.id as string)) summary.expired++;
  }

  // 3. Abandoned, unpaid drafts.
  const { data: abandoned } = await db()
    .from("surprises")
    .update({ stage: "EXPIRED" })
    .in("stage", ["DRAFT", "CUSTOMIZING"])
    .neq("payment_status", "PAID")
    .lte("draft_expires_at", now)
    .select("id");
  for (const row of abandoned ?? []) {
    await enqueueCleanup(row.id as string, "abandoned_draft");
    summary.abandonedDrafts++;
  }

  // 3b. Paid but never published, and the customer hasn't opened it for 60 days.
  //     Only the customer's own visits count (see touchCustomerActivity); admin views don't.
  const idleSince = new Date(Date.now() - UNPUBLISHED_PAID_TTL_DAYS * 86_400_000).toISOString();
  const { data: idlePaid } = await db()
    .from("surprises")
    .update({ stage: "EXPIRED" })
    .eq("payment_status", "PAID")
    .in("stage", ["DRAFT", "CUSTOMIZING", "READY_TO_PUBLISH"])
    .lte("last_customer_activity_at", idleSince)
    .select("id");
  for (const row of idlePaid ?? []) {
    await enqueueCleanup(row.id as string, "unpublished_paid");
    log.info("idle_paid_surprise_expired", { surpriseId: row.id as string });
    summary.idlePaidDeleted++;
  }

  // 4. Run due deletions (including retries).
  for (const outcome of await processDueCleanupJobs()) {
    if (outcome.ok) summary.cleanupSucceeded++;
    else summary.cleanupFailed++;
  }

  // 5. Photobooth: expire completed sessions after 7 days and delete their photos.
  //    Isolated so a photobooth problem can never block surprise maintenance.
  try {
    const booth = await runPhotoboothMaintenance();
    summary.photoboothExpired = booth.expired;
    summary.photoboothDeleted = booth.deleted;
    summary.photoboothCleanupFailed = booth.failed;
  } catch (err) {
    log.error("photobooth_maintenance_failed", { error: errorMessage(err) });
  }

  // 6. Old rate-limit windows.
  await db()
    .from("rate_limits")
    .delete()
    .lt("window_start", new Date(Date.now() - 86_400_000).toISOString());

  log.info("maintenance_completed", { ...summary });
  return summary;
}
