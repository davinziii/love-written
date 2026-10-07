/** Reasons a recipient can choose when reporting a surprise (mirrors the Terms page). */
export const CONTENT_REPORT_REASONS = {
  harassment: "Harassment, threats or bullying",
  explicit: "Sexual or explicit content",
  hate: "Hate or violence",
  impersonation: "Impersonation or scam",
  private_info: "Shares someone's private information",
  other: "Something else",
} as const;
export type ContentReportReason = keyof typeof CONTENT_REPORT_REASONS;
