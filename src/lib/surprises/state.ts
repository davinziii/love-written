import "server-only";
import { db } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { studioScreen } from "@/lib/lifecycle";
import type { SurpriseRow } from "@/lib/db-types";
import type { StudioState } from "@/lib/studio-types";
import { getMedia, latestOrder, latestPublishOperation, mediaUrlsByField, publicUrl } from "./repo";

/** Build the customer-facing view of a surprise. */
export async function buildStudioState(
  row: SurpriseRow,
  { withMedia }: { withMedia: boolean },
): Promise<StudioState> {
  const [order, op, media] = await Promise.all([
    latestOrder(row.id),
    latestPublishOperation(row.id),
    withMedia ? getMedia(row.id) : Promise.resolve([]),
  ]);

  const failedOp = row.stage === "PUBLISH_FAILED" && op?.status === "FAILED" ? op : null;
  let report: StudioState["report"] = null;
  if (failedOp) {
    const { data } = await db()
      .from("reports")
      .select("report_code")
      .eq("publish_operation_id", failedOp.id)
      .maybeSingle();
    if (data) report = { code: data.report_code as string };
  }

  return {
    id: row.id,
    templateId: row.template_id,
    stage: row.stage,
    paymentStatus: row.payment_status,
    screen: studioScreen(row.stage, row.payment_status),
    content: row.content ?? {},
    style: row.style ?? {},
    media: withMedia ? await mediaUrlsByField(media) : {},
    revealMode: row.reveal_mode,
    scheduledFor: row.scheduled_for,
    publishedAt: row.published_at,
    expiresAt: row.expires_at,
    publicUrl: publicUrl(row.public_token),
    order: order
      ? { orderNumber: order.order_number, status: order.status, paidAt: order.paid_at, paymentMethod: order.payment_method }
      : null,
    publishFailure: failedOp ? { operationId: failedOp.id, at: failedOp.finished_at ?? failedOp.started_at } : null,
    report,
    priceCentavos: env().PRICE_CENTAVOS,
  };
}
