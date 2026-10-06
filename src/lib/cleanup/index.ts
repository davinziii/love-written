import "server-only";
import { db } from "@/lib/supabase/admin";
import { log, errorMessage } from "@/lib/log";
import type { CleanupJobRow } from "@/lib/db-types";
import { listSurpriseObjects, removeObjects } from "@/lib/media/storage";

/**
 * Deletion lifecycle. A surprise is only marked DELETED after its photos and content
 * are removed AND a second check confirms they are gone. Failures retry with backoff;
 * after MAX_AUTO_ATTEMPTS the surprise moves to CLEANUP_FAILED for the admin queue.
 *
 * Retained after deletion (not customer content): the surprise row's ids, timestamps and
 * statuses, orders/payments (financial records), publish operations and reports.
 */

export const CLEANUP_BACKOFF_MINUTES = [15, 60, 360] as const;
export const MAX_AUTO_ATTEMPTS = CLEANUP_BACKOFF_MINUTES.length;
const STALE_RUNNING_MS = 10 * 60_000;

export type CleanupReason = CleanupJobRow["reason"];

export async function enqueueCleanup(surpriseId: string, reason: CleanupReason): Promise<void> {
  const { error } = await db()
    .from("cleanup_jobs")
    .upsert({ surprise_id: surpriseId, reason }, { onConflict: "surprise_id", ignoreDuplicates: true });
  if (error) throw new Error(`enqueue cleanup: ${error.message}`);
}

export interface CleanupOutcome {
  jobId: string;
  surpriseId: string;
  ok: boolean;
  error?: string;
}

/** Run one job now. `force` lets an admin retry a job that exhausted automatic attempts. */
export async function runCleanupJob(jobId: string, { force = false } = {}): Promise<CleanupOutcome | null> {
  let claim = db()
    .from("cleanup_jobs")
    .update({ status: "RUNNING", last_attempt_at: new Date().toISOString() })
    .eq("id", jobId)
    .in("status", ["PENDING", "FAILED"]);
  if (!force) claim = claim.lt("attempts", MAX_AUTO_ATTEMPTS);
  const { data: claimed, error: claimError } = await claim.select("*");
  if (claimError) throw new Error(`claim cleanup: ${claimError.message}`);
  const job = (claimed?.[0] as CleanupJobRow | undefined) ?? null;
  if (!job) return null; // someone else has it, or nothing to do

  const surpriseId = job.surprise_id;
  let remaining: string[] = [];
  try {
    const { data: s } = await db().from("surprises").select("stage").eq("id", surpriseId).single();
    if (s?.stage === "PUBLISHED") throw new Error("refusing to delete a live surprise");

    // 1. Delete stored objects.
    const objects = await listSurpriseObjects(surpriseId);
    await removeObjects(objects);

    // 2. Delete media rows.
    const { error: mediaError } = await db().from("media").delete().eq("surprise_id", surpriseId);
    if (mediaError) throw new Error(`delete media rows: ${mediaError.message}`);

    // 3. Wipe content and mark deleted.
    const { error: wipeError } = await db()
      .from("surprises")
      .update({ content: {}, style: {}, stage: "DELETED", deleted_at: new Date().toISOString() })
      .eq("id", surpriseId);
    if (wipeError) throw new Error(`wipe content: ${wipeError.message}`);

    // 4. Verify everything is really gone.
    remaining = await listSurpriseObjects(surpriseId);
    const { count } = await db().from("media").select("id", { count: "exact", head: true }).eq("surprise_id", surpriseId);
    const { data: after } = await db().from("surprises").select("content, style").eq("id", surpriseId).single();
    const contentGone = after && Object.keys(after.content ?? {}).length === 0 && Object.keys(after.style ?? {}).length === 0;
    if (remaining.length > 0 || (count ?? 0) > 0 || !contentGone) {
      throw new Error(`verification failed: ${remaining.length} objects, ${count ?? "?"} media rows remain`);
    }

    await db()
      .from("cleanup_jobs")
      .update({
        status: "SUCCEEDED",
        attempts: job.attempts + 1,
        finished_at: new Date().toISOString(),
        last_error: null,
        failed_items: [],
      })
      .eq("id", job.id);
    log.info("cleanup_succeeded", { surpriseId, jobId: job.id, reason: job.reason });
    return { jobId: job.id, surpriseId, ok: true };
  } catch (err) {
    const attempts = job.attempts + 1;
    const message = errorMessage(err);
    const exhausted = attempts >= MAX_AUTO_ATTEMPTS;
    const backoff = CLEANUP_BACKOFF_MINUTES[Math.min(attempts - 1, CLEANUP_BACKOFF_MINUTES.length - 1)]!;
    if (remaining.length === 0) remaining = await listSurpriseObjects(surpriseId).catch(() => []);

    await db()
      .from("cleanup_jobs")
      .update({
        status: "FAILED",
        attempts,
        last_error: message,
        failed_items: remaining,
        next_retry_at: new Date(Date.now() + backoff * 60_000).toISOString(),
      })
      .eq("id", job.id);

    // Never claim DELETED when deletion failed.
    await db().from("surprises").update({ stage: exhausted ? "CLEANUP_FAILED" : "EXPIRED" }).eq("id", surpriseId).neq("stage", "PUBLISHED");

    if (exhausted) log.error("cleanup_needs_admin", { surpriseId, jobId: job.id, attempts, error: message });
    else log.warn("cleanup_failed_will_retry", { surpriseId, jobId: job.id, attempts, error: message });
    return { jobId: job.id, surpriseId, ok: false, error: message };
  }
}

export async function processDueCleanupJobs(limit = 20): Promise<CleanupOutcome[]> {
  // Jobs stuck in RUNNING (crashed function) become retryable.
  await db()
    .from("cleanup_jobs")
    .update({ status: "FAILED", last_error: "Timed out" })
    .eq("status", "RUNNING")
    .lt("last_attempt_at", new Date(Date.now() - STALE_RUNNING_MS).toISOString());

  const { data, error } = await db()
    .from("cleanup_jobs")
    .select("id")
    .in("status", ["PENDING", "FAILED"])
    .lt("attempts", MAX_AUTO_ATTEMPTS)
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at")
    .limit(limit);
  if (error) throw new Error(`load cleanup jobs: ${error.message}`);

  const results: CleanupOutcome[] = [];
  for (const { id } of data ?? []) {
    const outcome = await runCleanupJob(id as string);
    if (outcome) results.push(outcome);
  }
  return results;
}
