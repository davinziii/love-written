/**
 * Lifecycle state machine. Pure — no I/O — so it is shared by server code, the studio UI
 * and unit tests. Database updates enforce the same rules with compare-and-set queries.
 *
 *   stage:          DRAFT → CUSTOMIZING → READY_TO_PUBLISH → (SCHEDULED →) PUBLISHED
 *                   → EXPIRED → DELETED     (+ PUBLISH_FAILED, CLEANUP_FAILED, DISABLED)
 *   payment_status: UNPAID → AWAITING_PAYMENT → PAID   (or PAYMENT_FAILED)
 *
 * Payment and publishing are tracked separately: PAID + PUBLISH_FAILED is a valid,
 * recoverable state and never requires paying again.
 */

export const STAGES = [
  "DRAFT",
  "CUSTOMIZING",
  "READY_TO_PUBLISH",
  "SCHEDULED",
  "PUBLISHED",
  "PUBLISH_FAILED",
  "EXPIRED",
  "CLEANUP_FAILED",
  "DELETED",
  "DISABLED",
] as const;
export type Stage = (typeof STAGES)[number];

export const PAYMENT_STATUSES = ["UNPAID", "AWAITING_PAYMENT", "PAID", "PAYMENT_FAILED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const HOSTING_DAYS = 30;
export const DRAFT_TTL_DAYS = 14;
/** A PAID surprise that is never published is deleted after this many days without a customer visit. */
export const UNPUBLISHED_PAID_TTL_DAYS = 60;
export const MIN_SCHEDULE_LEAD_MINUTES = 5;
export const MAX_SCHEDULE_DAYS_AHEAD = 180;

const DAY_MS = 86_400_000;

/** Content can change only before the surprise goes live. */
export const EDITABLE_STAGES: readonly Stage[] = [
  "DRAFT",
  "CUSTOMIZING",
  "READY_TO_PUBLISH",
  "PUBLISH_FAILED",
  "SCHEDULED",
];

/**
 * Stages from which a PAID surprise may be published or (re)scheduled.
 * DRAFT/CUSTOMIZING are included for the manual workflow, where the customer pays first
 * and customizes afterwards (payment_status must still be PAID — see canPublish).
 */
export const PUBLISHABLE_STAGES: readonly Stage[] = ["DRAFT", "CUSTOMIZING", "READY_TO_PUBLISH", "PUBLISH_FAILED", "SCHEDULED"];

/** Stages whose surprise data still exists and has not been handed to cleanup. */
export const PRE_PAYMENT_STAGES: readonly Stage[] = ["DRAFT", "CUSTOMIZING"];

export function canEdit(stage: Stage): boolean {
  return EDITABLE_STAGES.includes(stage);
}

/** Once scheduled, saves must keep the surprise publishable (strict validation). */
export function requiresStrictSave(stage: Stage): boolean {
  return stage === "SCHEDULED";
}

export function canCheckout(stage: Stage, payment: PaymentStatus): boolean {
  return PRE_PAYMENT_STAGES.includes(stage) && payment !== "PAID";
}

export function canPublish(stage: Stage, payment: PaymentStatus): boolean {
  return payment === "PAID" && PUBLISHABLE_STAGES.includes(stage);
}

export function expiryFrom(liveAt: Date): Date {
  return new Date(liveAt.getTime() + HOSTING_DAYS * DAY_MS);
}

export function draftExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + DRAFT_TTL_DAYS * DAY_MS);
}

export function validateScheduleTime(
  scheduledFor: Date,
  now: Date = new Date(),
): { ok: true } | { ok: false; message: string } {
  if (Number.isNaN(scheduledFor.getTime())) return { ok: false, message: "Choose a valid date and time." };
  if (scheduledFor.getTime() < now.getTime() + MIN_SCHEDULE_LEAD_MINUTES * 60_000) {
    return { ok: false, message: `Choose a time at least ${MIN_SCHEDULE_LEAD_MINUTES} minutes from now.` };
  }
  if (scheduledFor.getTime() > now.getTime() + MAX_SCHEDULE_DAYS_AHEAD * DAY_MS) {
    return { ok: false, message: `Choose a time within the next ${MAX_SCHEDULE_DAYS_AHEAD} days.` };
  }
  return { ok: true };
}

/* ─── Recipient access ─────────────────────────────────────────────────────── */

export type ViewerAccess =
  | { kind: "live" }
  | { kind: "activate" } // scheduled time has passed; activate, then show
  | { kind: "not_yet"; revealAt: string }
  | { kind: "preparing" } // paid but publishing failed — being fixed
  | { kind: "ended" } // expired / deleted
  | { kind: "unavailable" } // disabled by admin
  | { kind: "not_found" };

export function viewerAccess(
  row: { stage: Stage; scheduled_for: string | null; expires_at: string | null },
  now: Date = new Date(),
): ViewerAccess {
  switch (row.stage) {
    case "PUBLISHED":
      if (row.expires_at && new Date(row.expires_at) <= now) return { kind: "ended" };
      return { kind: "live" };
    case "SCHEDULED":
      if (!row.scheduled_for) return { kind: "preparing" };
      return new Date(row.scheduled_for) <= now
        ? { kind: "activate" }
        : { kind: "not_yet", revealAt: row.scheduled_for };
    case "PUBLISH_FAILED":
      return { kind: "preparing" };
    case "EXPIRED":
    case "CLEANUP_FAILED":
    case "DELETED":
      return { kind: "ended" };
    case "DISABLED":
      return { kind: "unavailable" };
    default:
      return { kind: "not_found" };
  }
}

/* ─── Customer studio screen ───────────────────────────────────────────────── */

export type StudioScreen =
  | "edit" // customizing, preview, choose timing, checkout
  | "finalize" // paid — confirm publish now / schedule
  | "publish_failed" // paid, publish failed — try again / report
  | "scheduled" // link issued, waiting for reveal (still editable)
  | "live" // published, locked
  | "ended" // expired / deleted / disabled
  ;

export function studioScreen(stage: Stage, payment: PaymentStatus): StudioScreen {
  switch (stage) {
    case "PUBLISHED":
      return "live";
    case "SCHEDULED":
      return "scheduled";
    case "PUBLISH_FAILED":
      return "publish_failed";
    case "READY_TO_PUBLISH":
      return "finalize";
    case "EXPIRED":
    case "CLEANUP_FAILED":
    case "DELETED":
    case "DISABLED":
      return "ended";
    default:
      // DRAFT / CUSTOMIZING: keep editing. If already paid (manual workflow), the editor
      // leads to publish/schedule instead of checkout.
      void payment;
      return "edit";
  }
}
