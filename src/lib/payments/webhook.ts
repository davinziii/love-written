import "server-only";
import { db } from "@/lib/supabase/admin";
import { env, paymongoSecrets } from "@/lib/env";
import { log, errorMessage } from "@/lib/log";
import { track } from "@/lib/analytics/server";
import { UNIQUE_VIOLATION, type OrderRow } from "@/lib/db-types";
import { verifyPaymongoSignature } from "./signature";
import { alert } from "@/lib/alerts";
import { nudge } from "@/lib/photobooth/realtime";

/**
 * PayMongo webhook processing — the ONLY place an order becomes PAID.
 *
 * Safe to receive the same event many times:
 *   • payment_events.provider_event_id is unique (inbox de-duplication)
 *   • payments.provider_payment_id is unique
 *   • order/surprise updates are compare-and-set
 * Publishing is never triggered here; the customer confirms publishing afterwards.
 */

export interface WebhookOutcome {
  status: number;
  body: Record<string, unknown>;
}

interface PaymentInfo {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  paidAt: string | null;
  paymentIntentId: string | null;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (typeof v === "object" && v !== null ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function parsePayment(resource: unknown): PaymentInfo | null {
  const r = obj(resource);
  const a = obj(r.attributes);
  const id = str(r.id);
  const amount = num(a.amount);
  if (!id || amount === null) return null;
  const paidAtUnix = num(a.paid_at);
  return {
    id,
    amount,
    currency: str(a.currency) ?? "",
    status: str(a.status) ?? "",
    method: str(obj(a.source).type),
    paidAt: paidAtUnix ? new Date(paidAtUnix * 1000).toISOString() : null,
    paymentIntentId: str(a.payment_intent_id),
  };
}

export async function handlePaymongoWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookOutcome> {
  const e = env();
  if (!verifyPaymongoSignature({ header: signatureHeader, rawBody, secret: paymongoSecrets().webhookSecret, mode: e.PAYMONGO_MODE })) {
    log.warn("webhook_signature_invalid");
    return { status: 401, body: { error: "invalid signature" } };
  }

  let payload: Json;
  try {
    payload = obj(JSON.parse(rawBody));
  } catch {
    return { status: 400, body: { error: "invalid json" } };
  }

  const event = obj(payload.data);
  const eventId = str(event.id);
  const attrs = obj(event.attributes);
  const type = str(attrs.type);
  const livemode = attrs.livemode === true;
  const resource = obj(attrs.data);
  if (!eventId || !type) return { status: 400, body: { error: "malformed event" } };

  if (livemode !== (e.PAYMONGO_MODE === "live")) {
    log.warn("webhook_mode_mismatch", { eventId, type, livemode });
    return { status: 200, body: { ignored: "mode mismatch" } };
  }

  // Inbox: record once, skip if already processed.
  const { error: insertError } = await db().from("payment_events").insert({
    provider_event_id: eventId,
    type,
    livemode,
    resource_id: str(resource.id),
    payload,
  });
  if (insertError && insertError.code !== UNIQUE_VIOLATION) {
    log.error("webhook_inbox_failed", { eventId, error: insertError.message });
    return { status: 500, body: { error: "retry" } };
  }
  if (insertError) {
    const { data: existing } = await db()
      .from("payment_events")
      .select("processed_at")
      .eq("provider_event_id", eventId)
      .maybeSingle();
    if (existing?.processed_at) return { status: 200, body: { duplicate: true } };
  }

  try {
    await dispatch(type, resource, eventId, livemode);
    await db()
      .from("payment_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider_event_id", eventId);
    return { status: 200, body: { received: true } };
  } catch (err) {
    const message = errorMessage(err);
    log.error("webhook_processing_failed", { eventId, type, error: message });
    alert("webhook_failed", { "Event": eventId, "Type": type });
    await db().from("payment_events").update({ error: message }).eq("provider_event_id", eventId);
    return { status: 500, body: { error: "retry" } }; // PayMongo will retry
  }
}

async function dispatch(type: string, resource: Json, eventId: string, livemode: boolean) {
  switch (type) {
    case "checkout_session.payment.paid": {
      const sessionId = str(resource.id);
      const sessionAttrs = obj(resource.attributes);
      const payments = Array.isArray(sessionAttrs.payments) ? sessionAttrs.payments : [];
      const payment = payments.map(parsePayment).find((p) => p?.status === "paid") ?? null;
      const order =
        (sessionId ? await orderBy("checkout_session_id", sessionId) : null) ??
        (str(obj(sessionAttrs.metadata).order_id) ? await orderBy("id", str(obj(sessionAttrs.metadata).order_id)!) : null);
      if (!order || !payment || !sessionId) {
        log.error("webhook_unmatched_checkout", { eventId, sessionId: sessionId ?? "none" });
        return;
      }
      await markPaid(order, payment, sessionId, eventId, livemode);
      return;
    }
    case "payment.paid": {
      // Redundant safety net: the same payment may also arrive via checkout_session.payment.paid.
      const payment = parsePayment(resource);
      if (!payment?.paymentIntentId) return;
      const order = await orderBy("payment_intent_id", payment.paymentIntentId);
      if (!order?.checkout_session_id) return;
      await markPaid(order, payment, order.checkout_session_id, eventId, livemode);
      return;
    }
    case "payment.failed": {
      const payment = parsePayment(resource);
      if (!payment?.paymentIntentId) return;
      const order = await orderBy("payment_intent_id", payment.paymentIntentId);
      if (!order) return;
      // The checkout session stays open (they can try another method), so the order
      // remains AWAITING_PAYMENT; we only surface the failure to the customer.
      await db()
        .from(order.photobooth_session_id ? "photobooth_sessions" : "surprises")
        .update({ payment_status: "PAYMENT_FAILED" })
        .eq("id", order.photobooth_session_id ?? order.surprise_id!)
        .eq("payment_status", "AWAITING_PAYMENT");
      log.info("payment_failed", { orderId: order.id, eventId });
      await track("payment_failed", { surpriseId: order.surprise_id });
      return;
    }
    default:
      log.info("webhook_ignored", { eventId, type });
  }
}

async function orderBy(column: "id" | "checkout_session_id" | "payment_intent_id", value: string) {
  const { data, error } = await db().from("orders").select("*").eq(column, value).maybeSingle();
  if (error) throw new Error(`order lookup: ${error.message}`);
  return data as OrderRow | null;
}

async function markPaid(order: OrderRow, payment: PaymentInfo, sessionId: string, eventId: string, livemode: boolean) {
  // Never trust the event blindly: amount and currency must match what we charged.
  if (payment.status !== "paid" || payment.amount !== order.amount_centavos || payment.currency.toUpperCase() !== "PHP") {
    log.error("webhook_amount_mismatch", {
      orderId: order.id,
      expected: order.amount_centavos,
      received: payment.amount,
      currency: payment.currency,
    });
    // Not retryable — keep the evidence on the event for the admin and stop here.
    await db()
      .from("payment_events")
      .update({ error: "payment amount/currency/status does not match order" })
      .eq("provider_event_id", eventId);
    return;
  }

  const { error: payError } = await db().from("payments").upsert(
    {
      order_id: order.id,
      provider_payment_id: payment.id,
      checkout_session_id: sessionId,
      amount_centavos: payment.amount,
      currency: payment.currency.toUpperCase(),
      method: payment.method,
      status: payment.status,
      livemode,
      provider_event_id: eventId,
      paid_at: payment.paidAt,
    },
    { onConflict: "provider_payment_id", ignoreDuplicates: true },
  );
  if (payError) throw new Error(`record payment: ${payError.message}`);

  const { data: updated, error: orderError } = await db()
    .from("orders")
    .update({ status: "PAID", paid_at: payment.paidAt ?? new Date().toISOString() })
    .eq("id", order.id)
    .neq("status", "PAID")
    .select("id");
  if (orderError) {
    if (orderError.code === UNIQUE_VIOLATION) {
      // Another order for this surprise is already paid: a genuine double payment.
      // Recorded in `payments` for the admin to handle; never auto-refunded.
      log.error("duplicate_payment_detected", { orderId: order.id, surpriseId: order.surprise_id, paymentId: payment.id });
      alert("duplicate_payment", { "Order": order.order_number, "PayMongo payment": payment.id });
      return;
    }
    throw new Error(`mark order paid: ${orderError.message}`);
  }

  if (order.photobooth_session_id) {
    // Photobooth: payment opens the session (camera check, invite…). The 7-day photo
    // retention does NOT start here — only when the photobooth is completed.
    const { error: boothError } = await db()
      .from("photobooth_sessions")
      .update({ payment_status: "PAID", status: "PAID", paid_at: payment.paidAt ?? new Date().toISOString(), last_activity_at: new Date().toISOString() })
      .eq("id", order.photobooth_session_id)
      .eq("status", "AWAITING_PAYMENT");
    if (boothError) throw new Error(`mark photobooth paid: ${boothError.message}`);
    if (updated && updated.length > 0) {
      log.info("photobooth_payment_confirmed", { orderId: order.id, sessionId: order.photobooth_session_id, paymentId: payment.id });
      const { data: booth } = await db().from("photobooth_sessions").select("realtime_key").eq("id", order.photobooth_session_id).maybeSingle();
      if (booth?.realtime_key) await nudge(booth.realtime_key as string);
    }
    return;
  }

  await db().from("surprises").update({ payment_status: "PAID" }).eq("id", order.surprise_id!);
  await db()
    .from("surprises")
    .update({ stage: "READY_TO_PUBLISH" })
    .eq("id", order.surprise_id!)
    .in("stage", ["DRAFT", "CUSTOMIZING"]);

  if (updated && updated.length > 0) {
    log.info("payment_confirmed", { orderId: order.id, orderNumber: order.order_number, paymentId: payment.id });
    await track("payment_successful", { surpriseId: order.surprise_id });
  }
}
