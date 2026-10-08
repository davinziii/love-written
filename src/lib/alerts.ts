import "server-only";
import { after } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";

/**
 * Email alerts to the owner when something needs attention.
 *
 * Sent through Resend's HTTP API (free tier, no SDK). Without RESEND_API_KEY alerts are
 * only logged. Alerts never contain customer messages, photos, tokens or secrets — just
 * what happened and where to look in the admin.
 *
 * Throttled per kind (see LIMITS.alertEmail) so a burst of errors can't flood the inbox.
 */
export type AlertKind =
  | "publish_failed"
  | "failed_publish_report"
  | "content_report"
  | "cleanup_needs_admin"
  | "duplicate_payment"
  | "webhook_failed"
  | "maintenance_failed"
  | "server_error"
  | "photobooth_failed";

const SUBJECTS: Record<AlertKind, string> = {
  publish_failed: "A paid surprise failed to publish",
  failed_publish_report: "A customer reported a failed publish",
  content_report: "A surprise was reported for abuse",
  cleanup_needs_admin: "A deletion needs your attention",
  duplicate_payment: "Possible double payment",
  webhook_failed: "Payment webhook processing failed",
  maintenance_failed: "Scheduled maintenance failed",
  server_error: "The website hit a server error",
  photobooth_failed: "A paid photobooth needs your attention",
};

const ADMIN_PATH: Record<AlertKind, string> = {
  publish_failed: "/admin/failed-publish",
  failed_publish_report: "/admin/reports",
  content_report: "/admin/reports",
  cleanup_needs_admin: "/admin/cleanup",
  duplicate_payment: "/admin/orders",
  webhook_failed: "/admin/orders",
  maintenance_failed: "/admin",
  server_error: "/admin",
  photobooth_failed: "/admin/photobooth",
};

async function deliver(kind: AlertKind, details: Record<string, string | number | undefined>) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL || "lovewritten.business@gmail.com";
  const from = process.env.ALERT_FROM || "Love, Written <onboarding@resend.dev>";
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  const lines = [
    SUBJECTS[kind],
    "",
    ...Object.entries(details)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}`),
    "",
    site ? `Open the admin: ${site}${ADMIN_PATH[kind]}` : "",
    `Time: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Manila)`,
  ];

  console.log(JSON.stringify({ level: "warn", event: "alert", kind, at: new Date().toISOString() }));
  if (!apiKey) return;

  // Max a few emails per kind per hour.
  if (!(await checkRateLimit("alertEmail", kind, { failOpen: true }))) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: `[Love, Written] ${SUBJECTS[kind]}`, text: lines.join("\n") }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) {
    console.error(JSON.stringify({ level: "error", event: "alert_send_failed", kind, status: res?.status ?? "network" }));
  }
}

/**
 * Queue an alert. Inside a request it runs after the response is sent (so customers
 * never wait for it); elsewhere it runs immediately. Never throws.
 */
export function alert(kind: AlertKind, details: Record<string, string | number | undefined> = {}): void {
  const run = () => deliver(kind, details).catch(() => undefined);
  try {
    after(run);
  } catch {
    void run();
  }
}
