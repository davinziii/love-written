import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/security/tokens";
import { runMaintenance } from "@/lib/surprises/lifecycle-jobs";
import { log, errorMessage } from "@/lib/log";
import { alert } from "@/lib/alerts";

export const maxDuration = 60;

/**
 * Activates due scheduled surprises, expires old ones, removes abandoned drafts and
 * runs deletion retries. Called by Vercel Cron (Authorization: Bearer CRON_SECRET) and,
 * optionally, more often by Supabase pg_cron — see docs/DEPLOYMENT.md.
 */
export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!safeEqual(auth, `Bearer ${env().CRON_SECRET}`)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await runMaintenance());
  } catch (err) {
    log.error("maintenance_failed", { error: errorMessage(err) });
    alert("maintenance_failed", { "Error": errorMessage(err).slice(0, 200) });
    return NextResponse.json({ error: "maintenance failed" }, { status: 500 });
  }
}
