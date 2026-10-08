import "server-only";
import { env, paymongoSecrets } from "@/lib/env";

/**
 * Minimal PayMongo client (Checkout Sessions API).
 * Docs: https://docs.paymongo.com/reference/create-a-checkout
 * The secret key never leaves the server.
 */
const API = "https://api.paymongo.com/v1";

function authHeader(): string {
  return `Basic ${Buffer.from(`${paymongoSecrets().secretKey}:`).toString("base64")}`;
}

export interface CreatedCheckout {
  id: string;
  checkoutUrl: string;
  paymentIntentId: string | null;
}

export async function createCheckoutSession(input: {
  orderId: string;
  orderNumber: string;
  amountCentavos: number;
  /** Line item shown on the PayMongo page. */
  itemName: string;
  itemDescription: string;
  /** Internal ids only (strings) — never customer content. */
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}): Promise<CreatedCheckout> {
  const methods = env()
    .PAYMONGO_PAYMENT_METHODS.split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const res = await fetch(`${API}/checkout_sessions`, {
    method: "POST",
    headers: { authorization: authHeader(), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              name: input.itemName,
              description: input.itemDescription,
              amount: input.amountCentavos,
              currency: "PHP",
              quantity: 1,
            },
          ],
          payment_method_types: methods,
          description: `Love, Written order ${input.orderNumber}`,
          reference_number: input.orderNumber,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          send_email_receipt: true,
          show_line_items: true,
          // Metadata values must be strings. Only internal ids — no customer content.
          metadata: { order_id: input.orderId, ...input.metadata },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await res.json().catch(() => null)) as {
    data?: { id?: string; attributes?: { checkout_url?: string; payment_intent?: { id?: string } } };
    errors?: { detail?: string }[];
  } | null;

  if (!res.ok || !body?.data?.id || !body.data.attributes?.checkout_url) {
    const detail = body?.errors?.map((e) => e.detail).join("; ") ?? `HTTP ${res.status}`;
    throw new Error(`PayMongo checkout creation failed: ${detail}`);
  }
  return {
    id: body.data.id,
    checkoutUrl: body.data.attributes.checkout_url,
    paymentIntentId: body.data.attributes.payment_intent?.id ?? null,
  };
}

/** Best-effort: expire an old session so it can't be paid after we replace it. */
export async function expireCheckoutSession(id: string): Promise<boolean> {
  const res = await fetch(`${API}/checkout_sessions/${encodeURIComponent(id)}/expire`, {
    method: "POST",
    headers: { authorization: authHeader(), accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}
