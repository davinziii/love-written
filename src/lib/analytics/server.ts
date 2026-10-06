import "server-only";
import { db } from "@/lib/supabase/admin";
import { log } from "@/lib/log";
import type { AnalyticsEvent } from "./events";

/** Record a funnel event. Never throws — analytics must not break a customer flow. */
export async function track(
  name: AnalyticsEvent,
  ctx: { templateId?: string | null; surpriseId?: string | null } = {},
): Promise<void> {
  const { error } = await db()
    .from("analytics_events")
    .insert({ name, template_id: ctx.templateId ?? null, surprise_id: ctx.surpriseId ?? null });
  if (error) log.warn("analytics_insert_failed", { name, error: error.message });
}
