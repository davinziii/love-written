/**
 * Funnel analytics — deliberately tiny: an allow-listed event name, optional template
 * id and surprise id, a timestamp. No IPs, no user agents, no content.
 */

/** Events the browser may send (everything else is recorded by the server itself). */
export const CLIENT_EVENTS = [
  "landing_view",
  "pick_surprise_click",
  "template_selected",
  "customization_completed",
  "checkout_clicked",
] as const;

export const SERVER_EVENTS = [
  "customization_started",
  "payment_initiated",
  "payment_successful",
  "payment_failed",
  "published",
  "scheduled",
  "publish_failed",
  "recipient_opened",
  "upload_failed",
  "recovered",
] as const;

export type ClientEvent = (typeof CLIENT_EVENTS)[number];
export type ServerEvent = (typeof SERVER_EVENTS)[number];
export type AnalyticsEvent = ClientEvent | ServerEvent;

/** The funnel shown on the admin dashboard, in order. */
export const FUNNEL: { event: AnalyticsEvent; label: string }[] = [
  { event: "landing_view", label: "Landing page visit" },
  { event: "pick_surprise_click", label: "Pick a Surprise" },
  { event: "template_selected", label: "Template selected" },
  { event: "customization_started", label: "Customization started" },
  { event: "customization_completed", label: "Customization completed" },
  { event: "checkout_clicked", label: "Checkout" },
  { event: "payment_initiated", label: "Payment initiated" },
  { event: "payment_successful", label: "Payment successful" },
  { event: "published", label: "Published / scheduled" },
  { event: "recipient_opened", label: "Recipient opened" },
];
