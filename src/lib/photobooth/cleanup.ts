import "server-only";
import { db } from "@/lib/supabase/admin";
import { log, errorMessage } from "@/lib/log";
import { alert } from "@/lib/alerts";
import { listFolder, removeObjects } from "@/lib/media/storage";
import type { PhotoboothSessionRow } from "@/lib/db-types";
import { PHOTOBOOTH_IDLE_DAYS, PHOTOBOOTH_UNPAID_HOURS } from "./constants";
import { boothFolder } from "./session";

/**
 * Photobooth deletion — runs from the daily maintenance cron, never from a browser.
 *
 *   COMPLETED ──(expires_at passed)──▶ EXPIRED ──▶ delete photos ──▶ verify ──▶ DELETED
 *                                                       │ failure
 *                                                       ▼
 *                                        retry with backoff ──(3 tries)──▶ CLEANUP_FAILED (admin)
 *
 * Also removed: unpaid self-serve sessions after 48 h, and paid sessions nobody touched for
 * 60 days (the same idle rule as surprises). DELETED keeps only the session row's ids,
 * timestamps and status (orders/payments are financial records); participants (and so
 * every link) and rounds are deleted, and the files are verified gone first.
 */

const BACKOFF_MINUTES = [15, 60, 360] as const;
const MAX_ATTEMPTS = BACKOFF_MINUTES.length;

export interface BoothCleanupSummary {
  expired: number;
  deleted: number;
  failed: number;
}

export async function runPhotoboothMaintenance(limit = 50): Promise<BoothCleanupSummary> {
  const summary: BoothCleanupSummary = { expired: 0, deleted: 0, failed: 0 };
  const now = new Date();
  const iso = now.toISOString();

  // 1. Completed sessions past their 7 days → EXPIRED (access ends immediately).
  const { data: due } = await db()
    .from("photobooth_sessions")
    .update({ status: "EXPIRED", cleanup_reason: "expired", cleanup_next_at: iso })
    .eq("status", "COMPLETED")
    .lte("expires_at", iso)
    .select("id");
  for (const row of due ?? []) {
    summary.expired++;
    log.info("photobooth_session_expired", { sessionId: row.id as string });
  }

  // 2. Abandoned: unpaid for 48 h, or paid but untouched for 60 days.
  const unpaidBefore = new Date(now.getTime() - PHOTOBOOTH_UNPAID_HOURS * 3600_000).toISOString();
  await db()
    .from("photobooth_sessions")
    .update({ status: "EXPIRED", cleanup_reason: "unpaid", cleanup_next_at: iso })
    .eq("status", "AWAITING_PAYMENT")
    .neq("payment_status", "PAID")
    .lte("created_at", unpaidBefore);
  const idleBefore = new Date(now.getTime() - PHOTOBOOTH_IDLE_DAYS * 86_400_000).toISOString();
  await db()
    .from("photobooth_sessions")
    .update({ status: "EXPIRED", cleanup_reason: "idle", cleanup_next_at: iso })
    .in("status", ["PAID", "IN_PROGRESS", "GENERATING", "FINALIZATION_FAILED"])
    .lte("last_activity_at", idleBefore);

  // 3. Delete whatever is due.
  const { data: jobs } = await db()
    .from("photobooth_sessions")
    .select("*")
    .eq("status", "EXPIRED")
    .lte("cleanup_next_at", iso)
    .lt("cleanup_attempts", MAX_ATTEMPTS)
    .limit(limit);
  for (const s of (jobs ?? []) as PhotoboothSessionRow[]) {
    if (await deleteBooth(s)) summary.deleted++;
    else summary.failed++;
  }
  return summary;
}

/** Delete one session's photos and access. `force` lets an admin retry after CLEANUP_FAILED. */
export async function deleteBooth(s: PhotoboothSessionRow, { force = false } = {}): Promise<boolean> {
  log.info("photobooth_cleanup_started", { sessionId: s.id, reason: s.cleanup_reason ?? "admin" });
  try {
    const folder = boothFolder(s.id);
    const files = await listFolder(folder);
    await removeObjects(files);
    const remaining = await listFolder(folder);
    if (remaining.length > 0) throw new Error(`${remaining.length} file(s) still in storage`);

    const { error: mErr } = await db().from("photobooth_messages").delete().eq("session_id", s.id);
    if (mErr) throw new Error(`delete messages: ${mErr.message}`);
    const { error: rErr } = await db().from("photobooth_rounds").delete().eq("session_id", s.id);
    if (rErr) throw new Error(`delete rounds: ${rErr.message}`);
    const { error: pErr } = await db().from("photobooth_participants").delete().eq("session_id", s.id);
    if (pErr) throw new Error(`delete participants: ${pErr.message}`);
    const { error: sErr } = await db()
      .from("photobooth_sessions")
      .update({
        status: "DELETED",
        deleted_at: new Date().toISOString(),
        output_path: null,
        cleanup_error: null,
        cleanup_next_at: null,
      })
      .eq("id", s.id);
    if (sErr) throw new Error(`mark deleted: ${sErr.message}`);
    // An unpaid checkout link that's still open is retired too.
    await db().from("orders").update({ status: "EXPIRED" }).eq("photobooth_session_id", s.id).eq("status", "AWAITING_PAYMENT");
    log.info("photobooth_cleanup_completed", { sessionId: s.id, files: files.length });
    return true;
  } catch (err) {
    const attempts = (force ? 0 : s.cleanup_attempts) + 1;
    const giveUp = !force && attempts >= MAX_ATTEMPTS;
    const message = errorMessage(err).slice(0, 500);
    log.error("photobooth_cleanup_failed", { sessionId: s.id, attempts, error: message });
    await db()
      .from("photobooth_sessions")
      .update({
        status: giveUp ? "CLEANUP_FAILED" : "EXPIRED",
        cleanup_attempts: attempts,
        cleanup_error: message,
        cleanup_next_at: new Date(Date.now() + BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)]! * 60_000).toISOString(),
      })
      .eq("id", s.id);
    if (giveUp) alert("cleanup_needs_admin", { "Photobooth": s.id, "Problem": message.slice(0, 160) });
    return false;
  }
}
