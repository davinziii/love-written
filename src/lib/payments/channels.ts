/**
 * How a manually confirmed payment was made. Safe to import from client and server code
 * (the admin forms and the order lists use the same list and labels).
 */
export const MANUAL_PAYMENT_CHANNELS = ["gcash", "maya", "bank_transfer", "paypal", "other"] as const;
export type ManualPaymentChannel = (typeof MANUAL_PAYMENT_CHANNELS)[number];

export const PAYMENT_CHANNEL_LABELS: Record<ManualPaymentChannel, string> = {
  gcash: "GCash",
  maya: "Maya",
  bank_transfer: "Bank transfer",
  paypal: "PayPal",
  other: "Other",
};

/** Where to find the reference number, per channel (placeholder text in the admin form). */
export const PAYMENT_REFERENCE_HINT: Record<ManualPaymentChannel, string> = {
  gcash: "e.g. GCash ref no.",
  maya: "e.g. Maya ref no.",
  bank_transfer: "e.g. bank transfer ref",
  paypal: "e.g. PayPal transaction ID",
  other: "e.g. receipt no.",
};
