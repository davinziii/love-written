import { NextResponse } from "next/server";
import { handlePaymongoWebhook } from "@/lib/payments/webhook";
import { log, errorMessage } from "@/lib/log";

/**
 * PayMongo webhook endpoint. Subscribe to:
 *   checkout_session.payment.paid, payment.paid, payment.failed
 * The raw body is required for signature verification, so it is read as text.
 * Not rate limited by the app (signature check is cheap); see docs/CLOUDFLARE.md for
 * the WAF skip rule that keeps it reachable.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    if (rawBody.length > 512 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 });
    const outcome = await handlePaymongoWebhook(rawBody, req.headers.get("paymongo-signature"));
    return NextResponse.json(outcome.body, { status: outcome.status });
  } catch (err) {
    log.error("webhook_unhandled", { error: errorMessage(err) });
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }
}
