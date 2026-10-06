/**
 * Which payment workflow is active. Safe to import from client and server code.
 *
 *   manual   — launch workflow: customer orders by DM and pays manually; the admin confirms
 *              the payment and creates the order, which issues a private customization link.
 *   paymongo — self-serve: customer customizes, pays through PayMongo Checkout, and the
 *              verified webhook confirms payment. (All PayMongo code stays in place.)
 *
 * Set NEXT_PUBLIC_PAYMENT_MODE=paymongo to switch. Everything after "order is PAID" —
 * editing, publishing, scheduling, expiry — is identical in both modes.
 */
export type PaymentMode = "manual" | "paymongo";

export const PAYMENT_MODE: PaymentMode = process.env.NEXT_PUBLIC_PAYMENT_MODE === "paymongo" ? "paymongo" : "manual";

export const isManualPayments = PAYMENT_MODE === "manual";

/** Where customers send a message to order (manual mode), e.g. an Instagram or Messenger link. */
export const ORDER_CONTACT = {
  url: process.env.NEXT_PUBLIC_ORDER_URL ?? "",
  label: process.env.NEXT_PUBLIC_ORDER_LABEL || "Message us to order",
};
