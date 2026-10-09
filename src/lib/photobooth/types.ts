/** What the browser receives about a photobooth (no tokens, no storage paths). */

export type BoothStatus =
  | "AWAITING_PAYMENT"
  | "PAID"
  | "IN_PROGRESS"
  | "DESIGNING"
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
export type StripFilter = "bw" | "color";

/** A private photo link plus a stable key — the browser keeps the first link per key so images don't reload. */
export interface SignedPhoto {
  key: string;
  url: string;
}

export interface ChatMessage {
  id: number;
  mine: boolean;
  body: string;
  at: string;
}

/** Live-view connection details passed once between the two browsers (A offers, B answers). */
export interface RtcSignal {
  /** "pause": this person paused their video (away / saving data). */
  type: "offer" | "answer" | "request" | "pause";
  sdp?: string;
  /** Pairs an answer with its offer; a new value means "start over". */
  epoch: string;
  /** For "request": "hello" = just arrived (start fresh), "retry" = the last attempt failed. */
  reason?: "hello" | "retry";
}

export interface BoothPersonState {
  /** The name they typed when they opened their link. */
  name: string | null;
  /** Their pick for the strip's look (after the photos). */
  pick: { frame: string | null; filter: StripFilter | null; confirmed: boolean };
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
  review: { mine: SignedPhoto; theirs: SignedPhoto } | null;
  /** Approved photos so far (for the live strip preview): Person A's and B's per photo number. */
  approved: { round: number; a: SignedPhoto; b: SignedPhoto }[];
  /** The chosen filter once the strip is being made. */
  finalFilter: StripFilter | null;
  messages: ChatMessage[];
  result: {
    strip: { url: string; download: string };
    photos: { round: number; url: string; download: string }[];
    expiresAt: string;
    completedAt: string;
  } | null;
}
