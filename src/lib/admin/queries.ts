import "server-only";
import { db } from "@/lib/supabase/admin";
import { STAGES, type Stage } from "@/lib/lifecycle";
import { FUNNEL } from "@/lib/analytics/events";
import type {
  CleanupJobRow,
  MediaRow,
  OrderRow,
  PaymentRow,
  PublishOperationRow,
  ReportRow,
  SurpriseRow,
} from "@/lib/db-types";
import { MAX_AUTO_ATTEMPTS } from "@/lib/cleanup";

/** Read models for the admin dashboard. Never select credential hashes. */

const SURPRISE_COLUMNS =
  "id, template_id, stage, payment_status, public_token, reveal_mode, scheduled_for, published_at, expires_at, created_at, updated_at, disabled_reason, first_opened_at, open_count, content";

export type AdminSurprise = Pick<
  SurpriseRow,
  | "id"
  | "template_id"
  | "stage"
  | "payment_status"
  | "public_token"
  | "reveal_mode"
  | "scheduled_for"
  | "published_at"
  | "expires_at"
  | "created_at"
  | "updated_at"
  | "disabled_reason"
  | "first_opened_at"
  | "open_count"
  | "content"
> & { orders: (OrderRow & { payments: PaymentRow[] })[] };

export type SurpriseListView = "all" | "drafts" | "scheduled" | "published" | "expiring" | "expired";

export async function listSurprises(view: SurpriseListView, limit = 100): Promise<AdminSurprise[]> {
  let q = db().from("surprises").select(`${SURPRISE_COLUMNS}, orders(*, payments(*))`).limit(limit);
  const now = new Date().toISOString();
  switch (view) {
    case "all":
      q = q.neq("stage", "DELETED").order("updated_at", { ascending: false });
      break;
    case "drafts":
      q = q.in("stage", ["DRAFT", "CUSTOMIZING", "READY_TO_PUBLISH", "PUBLISH_FAILED"]).order("updated_at", { ascending: false });
      break;
    case "scheduled":
      q = q.eq("stage", "SCHEDULED").order("scheduled_for");
      break;
    case "published":
      q = q.eq("stage", "PUBLISHED").order("published_at", { ascending: false });
      break;
    case "expiring":
      q = q
        .eq("stage", "PUBLISHED")
        .lte("expires_at", new Date(Date.now() + 3 * 86_400_000).toISOString())
        .gte("expires_at", now)
        .order("expires_at");
      break;
    case "expired":
      q = q.in("stage", ["EXPIRED", "CLEANUP_FAILED", "DELETED"]).order("updated_at", { ascending: false });
      break;
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminSurprise[];
}

export interface FailedPublishItem {
  surprise: AdminSurprise;
  order: OrderRow | undefined;
  payment: PaymentRow | undefined;
  operation: PublishOperationRow | undefined;
  report: ReportRow | undefined;
}

export async function listFailedPublishes(): Promise<FailedPublishItem[]> {
  const { data, error } = await db()
    .from("surprises")
    .select(`${SURPRISE_COLUMNS}, orders(*, payments(*)), publish_operations(*), reports(*)`)
    .eq("stage", "PUBLISH_FAILED")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  type Row = AdminSurprise & { publish_operations: PublishOperationRow[]; reports: ReportRow[] };
  return ((data ?? []) as unknown as Row[]).map((s) => {
    const order = s.orders.find((o) => o.status === "PAID");
    const operation = [...s.publish_operations]
      .filter((o) => o.status === "FAILED")
      .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
    return {
      surprise: s,
      order,
      payment: order?.payments[0],
      operation,
      report: s.reports.find((r) => r.publish_operation_id === operation?.id),
    };
  });
}

export async function listOrders(limit = 200) {
  const { data, error } = await db()
    .from("orders")
    .select("*, payments(*), surprises(id, template_id, stage, payment_status)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as (OrderRow & {
    payments: PaymentRow[];
    surprises: Pick<SurpriseRow, "id" | "template_id" | "stage" | "payment_status"> | null;
  })[];
}

export async function listReports(limit = 200) {
  const { data, error } = await db()
    .from("reports")
    .select("*, orders(order_number), surprises(id, stage, payment_status)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as (ReportRow & {
    orders: { order_number: string } | null;
    surprises: Pick<SurpriseRow, "id" | "stage" | "payment_status"> | null;
  })[];
}

export async function listCleanupProblems(): Promise<(CleanupJobRow & { exhausted: boolean })[]> {
  const { data, error } = await db()
    .from("cleanup_jobs")
    .select("*")
    .eq("status", "FAILED")
    .order("last_attempt_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return ((data ?? []) as CleanupJobRow[]).map((j) => ({ ...j, exhausted: j.attempts >= MAX_AUTO_ATTEMPTS }));
}

export async function surpriseDetail(id: string) {
  const { data, error } = await db()
    .from("surprises")
    .select(
      `${SURPRISE_COLUMNS}, schema_version, content, style, locked_at, draft_expires_at, deleted_at, disabled_at, last_customer_activity_at,
       orders(*, payments(*)), publish_operations(*), reports(*), cleanup_jobs(*), media(*)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as unknown as AdminSurprise &
    Pick<
      SurpriseRow,
      "schema_version" | "content" | "style" | "locked_at" | "draft_expires_at" | "deleted_at" | "disabled_at" | "last_customer_activity_at"
    > & {
      publish_operations: PublishOperationRow[];
      reports: ReportRow[];
      cleanup_jobs: CleanupJobRow[] | CleanupJobRow | null;
      media: MediaRow[];
    };
}

async function count(table: string) {
  const { count: n } = await db().from(table).select("*", { count: "exact", head: true });
  return n ?? 0;
}

export async function dashboardStats() {
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const stageCounts = await Promise.all(
    STAGES.map(async (stage: Stage) => {
      const { count: n } = await db().from("surprises").select("id", { count: "exact", head: true }).eq("stage", stage);
      return [stage, n ?? 0] as const;
    }),
  );

  const funnel = await Promise.all(
    FUNNEL.map(async (step) => {
      const { count: n } = await db()
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("name", step.event)
        .gte("created_at", since30);
      return { ...step, count: n ?? 0 };
    }),
  );

  const { data: monthPayments } = await db()
    .from("payments")
    .select("amount_centavos")
    .eq("status", "paid")
    .gte("created_at", monthStart.toISOString());

  const { count: openReports } = await db().from("reports").select("id", { count: "exact", head: true }).eq("status", "OPEN");
  const { count: paidThisMonth } = await db()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "PAID")
    .gte("paid_at", monthStart.toISOString());

  return {
    stages: Object.fromEntries(stageCounts) as Record<Stage, number>,
    funnel,
    revenueThisMonth: (monthPayments ?? []).reduce((sum, p) => sum + (p.amount_centavos as number), 0),
    customersThisMonth: paidThisMonth ?? 0,
    openReports: openReports ?? 0,
    totalSurprises: await count("surprises"),
  };
}

export async function storageStats() {
  const { data: media } = await db().from("media").select("bytes, created_at");
  const rows = (media ?? []) as { bytes: number; created_at: string }[];
  const since30 = Date.now() - 30 * 86_400_000;
  const { count: failedUploads } = await db()
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("name", "upload_failed")
    .gte("created_at", new Date(since30).toISOString());
  const { count: active } = await db()
    .from("surprises")
    .select("id", { count: "exact", head: true })
    .in("stage", ["PUBLISHED", "SCHEDULED"]);
  const { count: cleanupFailures } = await db()
    .from("cleanup_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "FAILED");
  return {
    totalBytes: rows.reduce((s, r) => s + r.bytes, 0),
    objectCount: rows.length,
    uploadsLast30Days: rows.filter((r) => new Date(r.created_at).getTime() >= since30).length,
    failedUploadsLast30Days: failedUploads ?? 0,
    activeSurprises: active ?? 0,
    cleanupFailures: cleanupFailures ?? 0,
  };
}

export async function templateUsage(): Promise<Record<string, number>> {
  const { data } = await db().from("surprises").select("template_id").neq("stage", "DELETED");
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { template_id: string }[]) out[r.template_id] = (out[r.template_id] ?? 0) + 1;
  return out;
}

/* ─── Dashboard ────────────────────────────────────────────────────────────── */

async function stageCount(stages: Stage[]): Promise<number> {
  const { count: n } = await db().from("surprises").select("id", { count: "exact", head: true }).in("stage", stages);
  return n ?? 0;
}

export async function attentionCounts() {
  const [failedPublish, cleanupFailed, reports, photobooth] = await Promise.all([
    stageCount(["PUBLISH_FAILED"]),
    stageCount(["CLEANUP_FAILED"]),
    db().from("reports").select("id", { count: "exact", head: true }).eq("status", "OPEN"),
    photoboothAttention(),
  ]);
  return { failedPublish, cleanupFailed, openReports: reports.count ?? 0, photobooth };
}

/** Photobooths needing a person: strip generation or deletion failed. 0 until migration 0005 runs. */
async function photoboothAttention(): Promise<number> {
  const { count, error } = await db()
    .from("photobooth_sessions")
    .select("id", { count: "exact", head: true })
    .in("status", ["FINALIZATION_FAILED", "CLEANUP_FAILED"]);
  return error ? 0 : (count ?? 0);
}

export type BoothListView = "all" | "active" | "completed" | "attention";

export interface AdminBooth {
  id: string;
  status: string;
  payment_status: string;
  current_round: number;
  frame_id: string | null;
  price_centavos: number;
  paid_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  last_activity_at: string;
  cleanup_attempts: number;
  cleanup_error: string | null;
  generation_error: string | null;
  created_at: string;
  photobooth_participants: { role: "A" | "B"; display_name: string | null; joined_at: string | null; last_seen_at: string | null; camera_ready_at: string | null; camera_issue: string | null; camera_issue_at: string | null; deletion_ack_at: string | null }[];
  orders: { order_number: string; status: string; payment_method: string; customer_label: string | null; amount_centavos: number }[];
}

const BOOTH_COLUMNS = `id, status, payment_status, current_round, frame_id, price_centavos, paid_at, completed_at, expires_at,
  last_activity_at, cleanup_attempts, cleanup_error, generation_error, created_at,
  photobooth_participants(role, display_name, joined_at, last_seen_at, camera_ready_at, camera_issue, camera_issue_at, deletion_ack_at),
  orders(order_number, status, payment_method, customer_label, amount_centavos)`;

/** Returns null if the photobooth tables don't exist yet (migration 0005 not run). */
export async function listBooths(view: BoothListView = "all", limit = 200): Promise<AdminBooth[] | null> {
  let q = db().from("photobooth_sessions").select(BOOTH_COLUMNS).order("updated_at", { ascending: false }).limit(limit);
  if (view === "active") q = q.in("status", ["PAID", "IN_PROGRESS", "GENERATING"]);
  if (view === "completed") q = q.in("status", ["COMPLETED", "EXPIRED", "DELETED"]);
  if (view === "attention") q = q.in("status", ["FINALIZATION_FAILED", "CLEANUP_FAILED"]);
  else q = q.neq("status", "AWAITING_PAYMENT");
  const { data, error } = await q;
  if (error) return null;
  return (data ?? []) as unknown as AdminBooth[];
}

export async function boothDetail(id: string): Promise<AdminBooth | null> {
  const { data, error } = await db().from("photobooth_sessions").select(BOOTH_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as AdminBooth | null;
}

export async function dashboardKpis() {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [total, published, scheduled, drafts, newThisWeek] = await Promise.all([
    db().from("surprises").select("id", { count: "exact", head: true }).neq("stage", "DELETED"),
    stageCount(["PUBLISHED"]),
    stageCount(["SCHEDULED"]),
    stageCount(["DRAFT", "CUSTOMIZING", "READY_TO_PUBLISH"]),
    db().from("surprises").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
  ]);
  return { total: total.count ?? 0, published, scheduled, drafts, newThisWeek: newThisWeek.count ?? 0 };
}

export interface ActivityDay {
  day: string; // YYYY-MM-DD (Asia/Manila)
  created: number;
  published: number;
}

const manilaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" });

/** Surprises created vs. gone live per day (Manila time) for the last `days` days. */
export async function surpriseActivity(days = 14): Promise<ActivityDay[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [created, published] = await Promise.all([
    db().from("surprises").select("created_at").gte("created_at", since),
    db().from("surprises").select("published_at").gte("published_at", since),
  ]);
  const series = new Map<string, ActivityDay>();
  for (let i = days - 1; i >= 0; i--) {
    const day = manilaDay.format(new Date(Date.now() - i * 86_400_000));
    series.set(day, { day, created: 0, published: 0 });
  }
  for (const r of (created.data ?? []) as { created_at: string }[]) {
    const d = series.get(manilaDay.format(new Date(r.created_at)));
    if (d) d.created++;
  }
  for (const r of (published.data ?? []) as { published_at: string }[]) {
    const d = series.get(manilaDay.format(new Date(r.published_at)));
    if (d) d.published++;
  }
  return [...series.values()];
}

/** Order search by order number, customer label or payment reference. */
export async function searchOrders(raw: string) {
  // Keep only characters that can appear in our values; strips PostgREST filter syntax.
  const q = raw.replace(/[^\p{L}\p{N}@._\- ]/gu, "").trim().slice(0, 60);
  if (!q) return [];
  const pattern = `"%${q}%"`; // quoted so spaces and dots are treated as data
  const { data, error } = await db()
    .from("orders")
    .select("*, payments(*), surprises(id, template_id, stage, payment_status)")
    .or(`order_number.ilike.${pattern},customer_label.ilike.${pattern},payment_reference.ilike.${pattern}`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Awaited<ReturnType<typeof listOrders>>;
}
