import "server-only";
import { db } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { Errors } from "@/lib/errors";
import { log, errorMessage } from "@/lib/log";
import { UNIQUE_VIOLATION, type OrderRow, type PhotoboothSessionRow } from "@/lib/db-types";
import { generateOrderNumber } from "@/lib/security/tokens";
import { openSecret } from "@/lib/security/access-vault";
import { createCheckoutSession, expireCheckoutSession } from "@/lib/payments/paymongo";
import type { ManualPaymentChannel } from "@/lib/payments/manual";
import { newParticipantCredentials, participantLink } from "./session";
import { photoboothPriceCentavos } from "./price";

/**
 * Photobooth payments reuse the Love, Written order/payment tables and the PayMongo
 * webhook (orders.photobooth_session_id). The webhook is the only thing that marks a
 * photobooth PAID; a browser saying "payment successful" means nothing on its own.
 */


const REUSE_OPEN_SESSION_MS = 60 * 60_000;

// ─── Self-serve (PayMongo) ──────────────────────────────────────────────────

/**
 * Create the session + both participants before payment. Idempotent per `createKey`
 * (a double click returns the same session and the same Person A link).
 */
export async function createPendingBooth(createKey: string): Promise<{ sessionId: string; token: string }> {
  const existing = await sessionByCreateKey(createKey);
  if (existing) return existing;

  const creds = newParticipantCredentials();
  const { data: session, error } = await db()
    .from("photobooth_sessions")
    .insert({ status: "AWAITING_PAYMENT", payment_status: "UNPAID", price_centavos: photoboothPriceCentavos(), create_key: createKey })
    .select("id")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      const winner = await sessionByCreateKey(createKey);
      if (winner) return winner;
    }
    throw new Error(`create photobooth: ${error.message}`);
  }
  const sessionId = session.id as string;
  const { error: pError } = await db().from("photobooth_participants").insert([
    { session_id: sessionId, role: "A", token_hash: creds.aHash, token_enc: creds.aEnc },
    { session_id: sessionId, role: "B", token_hash: creds.bHash, token_enc: creds.bEnc },
  ]);
  if (pError) throw new Error(`create participants: ${pError.message}`);
  log.info("photobooth_created", { sessionId, source: "self_serve" });
  return { sessionId, token: creds.a };
}

async function sessionByCreateKey(createKey: string): Promise<{ sessionId: string; token: string } | null> {
  const { data } = await db()
    .from("photobooth_sessions")
    .select("id, photobooth_participants(role, token_enc)")
    .eq("create_key", createKey)
    .maybeSingle();
  if (!data) return null;
  const a = (data.photobooth_participants as { role: string; token_enc: string | null }[]).find((p) => p.role === "A");
  const token = openSecret(a?.token_enc);
  return token ? { sessionId: data.id as string, token } : null;
}

export type BoothCheckoutResult = { kind: "redirect"; checkoutUrl: string } | { kind: "already_paid" };

/** Start or resume payment. At most one open-or-paid order per photobooth (unique index). */
export async function startBoothCheckout(session: PhotoboothSessionRow, idempotencyKey: string): Promise<BoothCheckoutResult> {
  if (session.payment_status === "PAID") return { kind: "already_paid" };
  if (session.status !== "AWAITING_PAYMENT") throw Errors.conflict("NOT_CHECKOUTABLE", "This photobooth can't be paid for right now.");

  const { data: sameKey } = await db()
    .from("orders")
    .select("*")
    .eq("photobooth_session_id", session.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (sameKey) return resume(sameKey as OrderRow);

  const { data: openRow } = await db()
    .from("orders")
    .select("*")
    .eq("photobooth_session_id", session.id)
    .eq("status", "AWAITING_PAYMENT")
    .maybeSingle();
  const open = openRow as OrderRow | null;
  if (open) {
    const fresh = Date.now() - new Date(open.created_at).getTime() < REUSE_OPEN_SESSION_MS;
    if (fresh && open.checkout_url) return { kind: "redirect", checkoutUrl: open.checkout_url };
    if (!fresh) {
      if (open.checkout_session_id) await expireCheckoutSession(open.checkout_session_id);
      await db().from("orders").update({ status: "EXPIRED" }).eq("id", open.id).eq("status", "AWAITING_PAYMENT");
    } else {
      throw Errors.conflict("CHECKOUT_PENDING", "We're preparing your payment page. Please try again in a moment.");
    }
  }

  const amount = session.price_centavos;
  const { data: inserted, error } = await db()
    .from("orders")
    .insert({
      order_number: generateOrderNumber(),
      photobooth_session_id: session.id,
      amount_centavos: amount,
      currency: "PHP",
      idempotency_key: idempotencyKey,
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) throw Errors.conflict("CHECKOUT_PENDING", "We're preparing your payment page. Please try again in a moment.");
    throw new Error(`create photobooth order: ${error.message}`);
  }
  const order = inserted as OrderRow;

  const site = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  let checkout;
  try {
    checkout = await createCheckoutSession({
      orderId: order.id,
      orderNumber: order.order_number,
      amountCentavos: amount,
      itemName: "Love, Written Photobooth",
      itemDescription: "A private two-person photobooth session — photos kept for 7 days after you finish",
      metadata: { photobooth_session_id: session.id },
      successUrl: `${site}/photobooth/s/${session.id}?paid=1`,
      cancelUrl: `${site}/photobooth/s/${session.id}?payment=cancelled`,
    });
  } catch (err) {
    log.error("photobooth_checkout_failed", { sessionId: session.id, orderId: order.id, error: errorMessage(err) });
    await db().from("orders").update({ status: "EXPIRED" }).eq("id", order.id).eq("status", "AWAITING_PAYMENT");
    throw Errors.unavailable("We couldn't open the payment page. You have not been charged. Please try again.");
  }
  await db()
    .from("orders")
    .update({ checkout_session_id: checkout.id, checkout_url: checkout.checkoutUrl, payment_intent_id: checkout.paymentIntentId })
    .eq("id", order.id);
  await db().from("photobooth_sessions").update({ payment_status: "AWAITING_PAYMENT" }).eq("id", session.id).neq("payment_status", "PAID");
  log.info("photobooth_checkout_created", { sessionId: session.id, orderId: order.id });
  return { kind: "redirect", checkoutUrl: checkout.checkoutUrl };
}

function resume(order: OrderRow): BoothCheckoutResult {
  if (order.status === "PAID") return { kind: "already_paid" };
  if (order.status === "AWAITING_PAYMENT" && order.checkout_url) return { kind: "redirect", checkoutUrl: order.checkout_url };
  throw Errors.conflict("CHECKOUT_PENDING", "We're preparing your payment page. Please try again in a moment.");
}

// ─── Manual (launch workflow): admin confirms payment, then creates the photobooth ──

export interface ManualBoothInput {
  amountCentavos: number;
  channel: ManualPaymentChannel;
  paymentReference?: string;
  customerLabel?: string;
  notes?: string;
  idempotencyKey: string;
}

export interface IssuedBooth {
  sessionId: string;
  orderNumber: string;
  linkA: string | null;
  linkB: string | null;
  replayed: boolean;
}

export async function createManualBooth(input: ManualBoothInput, adminId: string): Promise<IssuedBooth> {
  const creds = newParticipantCredentials();
  const { data, error } = await db().rpc("create_manual_photobooth", {
    p_a_hash: creds.aHash,
    p_a_enc: creds.aEnc,
    p_b_hash: creds.bHash,
    p_b_enc: creds.bEnc,
    p_order_number: generateOrderNumber(),
    p_amount_centavos: input.amountCentavos,
    p_idempotency_key: input.idempotencyKey,
    p_customer_label: input.customerLabel?.trim() ?? "",
    p_payment_channel: input.channel,
    p_payment_reference: input.paymentReference?.trim() ?? "",
    p_notes: input.notes?.trim() ?? "",
    p_admin: adminId,
  });
  if (error) throw new Error(`create manual photobooth: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as { session_id: string; order_number: string; replayed: boolean } | undefined;
  if (!row) throw new Error("create manual photobooth: no result");

  log.info("photobooth_created", { sessionId: row.session_id, source: "manual", adminId, replayed: row.replayed });
  if (!row.replayed) log.info("photobooth_payment_confirmed", { sessionId: row.session_id, method: "manual" });
  return {
    sessionId: row.session_id,
    orderNumber: row.order_number,
    linkA: row.replayed ? null : participantLink(row.session_id, creds.a),
    linkB: row.replayed ? null : participantLink(row.session_id, creds.b),
    replayed: row.replayed,
  };
}
