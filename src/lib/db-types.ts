import type { PaymentStatus, Stage } from "@/lib/lifecycle";

/** Row shapes for the tables in supabase/migrations/0001_init.sql. */

export interface SurpriseRow {
  id: string;
  template_id: string;
  schema_version: number;
  stage: Stage;
  payment_status: PaymentStatus;
  content: Record<string, string>;
  style: Record<string, string>;
  edit_token_hash: string;
  recovery_code_hash: string;
  public_token: string | null;
  reveal_mode: "now" | "schedule";
  scheduled_for: string | null;
  locked_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  draft_expires_at: string;
  disabled_at: string | null;
  disabled_reason: string | null;
  deleted_at: string | null;
  first_opened_at: string | null;
  open_count: number;
  /** Last time the customer opened/edited it with their private credential (not admin views). */
  last_customer_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface MediaRow {
  id: string;
  surprise_id: string;
  field_id: string;
  storage_path: string;
  bytes: number;
  width: number;
  height: number;
  created_at: string;
}

export type OrderStatus = "AWAITING_PAYMENT" | "PAID" | "PAYMENT_FAILED" | "EXPIRED";

export interface OrderRow {
  id: string;
  order_number: string;
  /** Exactly one of surprise_id / photobooth_session_id is set (one product per order). */
  surprise_id: string | null;
  photobooth_session_id: string | null;
  status: OrderStatus;
  amount_centavos: number;
  currency: string;
  idempotency_key: string;
  provider: string;
  checkout_session_id: string | null;
  checkout_url: string | null;
  payment_intent_id: string | null;
  payment_method: "manual" | "paymongo";
  customer_label: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_by: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRow {
  id: string;
  order_id: string;
  provider: "manual" | "paymongo";
  provider_payment_id: string;
  checkout_session_id: string | null;
  amount_centavos: number;
  currency: string;
  method: string | null;
  status: string;
  livemode: boolean;
  provider_event_id: string | null;
  confirmed_by: string | null;
  paid_at: string | null;
  created_at: string;
}

export type OperationStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

export interface PublishOperationRow {
  id: string;
  surprise_id: string;
  idempotency_key: string;
  mode: "now" | "schedule" | "activate";
  source: "customer" | "admin" | "scheduler";
  scheduled_for: string | null;
  status: OperationStatus;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface ReportRow {
  id: string;
  report_code: string;
  surprise_id: string;
  order_id: string | null;
  payment_id: string | null;
  provider_reference: string | null;
  publish_operation_id: string | null;
  idempotency_key: string;
  error_code: string | null;
  error_message: string | null;
  customer_message: string | null;
  status: "OPEN" | "RESOLVED";
  kind: "publish_failed" | "content";
  reason: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface CleanupJobRow {
  id: string;
  surprise_id: string;
  reason: "expired" | "abandoned_draft" | "admin" | "unpublished_paid";
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string;
  last_error: string | null;
  failed_items: string[];
  created_at: string;
  finished_at: string | null;
}

/** Postgres unique-violation error code. */
export const UNIQUE_VIOLATION = "23505";

// ─── Photobooth (supabase/migrations/0005_photobooth.sql) ───────────────────

export interface PhotoboothSessionRow {
  id: string;
  status: import("@/lib/photobooth/types").BoothStatus;
  payment_status: PaymentStatus;
  price_centavos: number;
  create_key: string | null;
  frame_id: string | null;
  current_round: number;
  attempt: number;
  round_phase: import("@/lib/photobooth/types").RoundPhase | null;
  capture_at: string | null;
  realtime_key: string;
  output_path: string | null;
  generation_claimed_at: string | null;
  generation_attempts: number;
  generation_error: string | null;
  paid_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  last_activity_at: string;
  cleanup_reason: "expired" | "idle" | "unpaid" | "admin" | null;
  cleanup_attempts: number;
  cleanup_next_at: string | null;
  cleanup_error: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PhotoboothParticipantRow {
  id: string;
  session_id: string;
  role: "A" | "B";
  token_hash: string;
  token_enc: string | null;
  device_id: string | null;
  joined_at: string | null;
  last_seen_at: string | null;
  camera_ready_at: string | null;
  camera_issue: import("@/lib/photobooth/types").CameraIssue | null;
  camera_issue_at: string | null;
  deletion_ack_at: string | null;
  ready_attempt: number | null;
  rtc_signal: import("@/lib/photobooth/types").RtcSignal | null;
  created_at: string;
  updated_at: string;
}

export interface PhotoboothRoundRow {
  session_id: string;
  attempt: number;
  round: number;
  status: "CAPTURING" | "REVIEW" | "APPROVED" | "RETAKEN" | "ABORTED";
  a_path: string | null;
  b_path: string | null;
  a_decision: "KEEP" | "RETAKE" | null;
  b_decision: "KEEP" | "RETAKE" | null;
  retake_by: "A" | "B" | null;
  created_at: string;
  updated_at: string;
}
