import type { PaymentStatus, Stage, StudioScreen } from "@/lib/lifecycle";

/** What the customer's browser receives about its own surprise (never secrets or hashes). */
export interface StudioState {
  id: string;
  templateId: string;
  stage: Stage;
  paymentStatus: PaymentStatus;
  screen: StudioScreen;
  content: Record<string, string>;
  style: Record<string, string>;
  /** image field id → signed URL (only included when requested) */
  media: Record<string, string>;
  revealMode: "now" | "schedule";
  scheduledFor: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  publicUrl: string | null;
  order: { orderNumber: string; status: string; paidAt: string | null; paymentMethod: "manual" | "paymongo" } | null;
  publishFailure: { operationId: string; at: string } | null;
  report: { code: string } | null;
  priceCentavos: number;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}
