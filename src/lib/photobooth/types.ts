/** What the browser receives about a photobooth (no tokens, no storage paths). */

export type BoothStatus =
  | "AWAITING_PAYMENT"
  | "PAID"
  | "IN_PROGRESS"
  | "GENERATING"
  | "FINALIZATION_FAILED"
  | "COMPLETED"
  | "EXPIRED"
  | "CLEANUP_FAILED"
  | "DELETED";

export type BoothRole = "A" | "B";
export type RoundPhase = "READY" | "COUNTDOWN" | "REVIEW";
export type Decision = "KEEP" | "RETAKE";
export type CameraIssue = "denied" | "unavailable" | "in_use" | "unsupported" | "other";

/** Live-view connection details passed once between the two browsers (A offers, B answers). */
export interface RtcSignal {
  type: "offer" | "answer" | "request";
  sdp?: string;
  /** Pairs an answer with its offer; a new value means "start over". */
  epoch: string;
}

export interface BoothPersonState {
  joined: boolean;
  connected: boolean;
  /** ms since we last heard from them (null = never). */
  awayMs: number | null;
  cameraReady: boolean;
  cameraIssue: CameraIssue | null;
  acknowledged: boolean;
  ready: boolean;
  uploaded: boolean;
  decision: Decision | null;
}

export interface BoothState {
  serverNow: number;
  sessionId: string;
  status: BoothStatus;
  paymentStatus: "UNPAID" | "AWAITING_PAYMENT" | "PAID" | "PAYMENT_FAILED";
  priceCentavos: number;
  frameId: string | null;
  round: number;
  attempt: number;
  phase: RoundPhase | null;
  /** Synchronized shutter time (server clock, ms). */
  captureAt: number | null;
  /** Why the current round restarted, if it did. */
  notice: { kind: "retake"; by: "me" | "partner" } | { kind: "aborted" } | null;
  realtimeKey: string;
  me: BoothPersonState & { role: BoothRole };
  partner: BoothPersonState;
  /** The partner's latest live-view signal (only while the photobooth is running). */
  partnerSignal: RtcSignal | null;
  /** Person A only: the invite link for Person B. */
  inviteLink: string | null;
  review: { mine: string; theirs: string } | null;
  result: {
    strip: { url: string; download: string };
    photos: { round: number; url: string; download: string }[];
    expiresAt: string;
    completedAt: string;
  } | null;
}
