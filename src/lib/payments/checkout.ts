import "server-only";
import { db } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { log, errorMessage } from "@/lib/log";
import { track } from "@/lib/analytics/server";
import { UNIQUE_VIOLATION, type OrderRow, type SurpriseRow } from "@/lib/db-types";
import { canCheckout, draftExpiryFrom, validateScheduleTime } from "@/lib/lifecycle";
import { generateOrderNumber } from "@/lib/security/tokens";
import { getTemplate } from "@/templates";
import { validateCustomerData } from "@/templates/schema";
import { customerData, getMedia, mediaFieldSet } from "@/lib/surprises/repo";
import { createCheckoutSession, expireCheckoutSession } from "./paymongo";

/** An unpaid checkout link younger than this is reused instead of creating a new one. */
const REUSE_OPEN_SESSION_MS = 60 * 60_000;

export type CheckoutResult = { kind: "redirect"; checkoutUrl: string } | { kind: "already_paid" };

/**
 * Start (or resume) payment for a surprise.
 * Idempotent per (surprise, key); at most one open-or-paid order per surprise is enforced
 * by a partial unique index, so double clicks and parallel tabs can't create two charges.
 */
export async function startCheckout(row: SurpriseRow, idempotencyKey: string): Promise<CheckoutResult> {
  if (row.payment_status === "PAID") return { kind: "already_paid" };
  if (!canCheckout(row.stage, row.payment_status)) {
    throw Errors.conflict("NOT_CHECKOUTABLE", "This surprise can't be checked out right now.");
  }

  // Same click submitted twice → same answer.
  const sameKey = await orderByKey(row.id, idempotencyKey);
  if (sameKey) return resumeOrder(sameKey);

  // Server-side validation — the editor's checks are only a convenience.
  const template = getTemplate(row.template_id);
  if (!template) throw Errors.badRequest("That template isn't available.");
  const media = await getMedia(row.id);
  const validation = validateCustomerData(template, customerData(row), {
    mode: "strict",
    imageFieldsPresent: mediaFieldSet(media),
  });
  if (!validation.ok) throw Errors.validation(validation.errors);
  if (row.reveal_mode === "schedule") {
    const check = validateScheduleTime(new Date(row.scheduled_for ?? NaN));
    if (!check.ok) throw Errors.validation({ scheduledFor: check.message });
  }

  // Reuse a recent open checkout; retire a stale one.
  const open = await openOrder(row.id);
  if (open) {
    const fresh = Date.now() - new Date(open.created_at).getTime() < REUSE_OPEN_SESSION_MS;
    if (fresh && open.checkout_url) return { kind: "redirect", checkoutUrl: open.checkout_url };
    if (!fresh) await retireOrder(open);
    else throw Errors.conflict("CHECKOUT_PENDING", "We're preparing your payment page. Please try again in a moment.");
  }

  const amount = env().PRICE_CENTAVOS; // never taken from the client
  const { data: inserted, error } = await db()
    .from("orders")
    .insert({
      order_number: generateOrderNumber(),
      surprise_id: row.id,
      amount_centavos: amount,
      currency: "PHP",
      idempotency_key: idempotencyKey,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const winner = (await orderByKey(row.id, idempotencyKey)) ?? (await openOrder(row.id));
      if (winner) return resumeOrder(winner);
    }
    throw new Error(`create order: ${error.message}`);
  }
  const order = inserted as OrderRow;

  const site = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  let session;
  try {
    session = await createCheckoutSession({
      orderId: order.id,
      orderNumber: order.order_number,
      amountCentavos: amount,
      itemName: `Love, Written — ${template.name}`,
      itemDescription: "Digital surprise, hosted for 30 days after it goes live",
      metadata: { surprise_id: row.id },
      successUrl: `${site}/studio/${row.id}?step=payment`,
      cancelUrl: `${site}/studio/${row.id}?step=preview&payment=cancelled`,
    });
  } catch (err) {
    log.error("checkout_create_failed", { surpriseId: row.id, orderId: order.id, error: errorMessage(err) });
    await db().from("orders").update({ status: "EXPIRED" }).eq("id", order.id).eq("status", "AWAITING_PAYMENT");
    throw Errors.unavailable("We couldn't open the payment page. You have not been charged. Please try again.");
  }

  await db()
    .from("orders")
    .update({
      checkout_session_id: session.id,
      checkout_url: session.checkoutUrl,
      payment_intent_id: session.paymentIntentId,
    })
    .eq("id", order.id);
  await db()
    .from("surprises")
    .update({ payment_status: "AWAITING_PAYMENT", draft_expires_at: draftExpiryFrom(new Date()).toISOString() })
    .eq("id", row.id)
    .neq("payment_status", "PAID");

  log.info("checkout_created", { surpriseId: row.id, orderId: order.id, orderNumber: order.order_number });
  await track("payment_initiated", { templateId: row.template_id, surpriseId: row.id });
  return { kind: "redirect", checkoutUrl: session.checkoutUrl };
}

function resumeOrder(order: OrderRow): CheckoutResult {
  if (order.status === "PAID") return { kind: "already_paid" };
  if (order.status === "AWAITING_PAYMENT" && order.checkout_url) {
    return { kind: "redirect", checkoutUrl: order.checkout_url };
  }
  throw Errors.conflict("CHECKOUT_PENDING", "We're preparing your payment page. Please try again in a moment.");
}

async function orderByKey(surpriseId: string, key: string): Promise<OrderRow | null> {
  const { data } = await db()
    .from("orders")
    .select("*")
    .eq("surprise_id", surpriseId)
    .eq("idempotency_key", key)
    .maybeSingle();
  return data as OrderRow | null;
}

async function openOrder(surpriseId: string): Promise<OrderRow | null> {
  const { data } = await db()
    .from("orders")
    .select("*")
    .eq("surprise_id", surpriseId)
    .eq("status", "AWAITING_PAYMENT")
    .maybeSingle();
  return data as OrderRow | null;
}

async function retireOrder(order: OrderRow): Promise<void> {
  if (order.checkout_session_id) await expireCheckoutSession(order.checkout_session_id);
  await db().from("orders").update({ status: "EXPIRED" }).eq("id", order.id).eq("status", "AWAITING_PAYMENT");
  log.info("checkout_retired", { orderId: order.id });
}
