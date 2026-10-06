import { z } from "zod";
import { CLIENT_EVENTS } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/server";
import { ipKey, readJson } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isTemplateId } from "@/templates";

const body = z.object({
  name: z.enum(CLIENT_EVENTS),
  templateId: z.string().max(64).optional(),
});

/** Allow-listed funnel events from the browser. Always 204 — analytics never errors the UI. */
export async function POST(req: Request) {
  try {
    if (await checkRateLimit("events", ipKey(req.headers), { failOpen: false })) {
      const input = await readJson(req, body);
      await track(input.name, { templateId: input.templateId && isTemplateId(input.templateId) ? input.templateId : null });
    }
  } catch {
    // ignore
  }
  return new Response(null, { status: 204 });
}
