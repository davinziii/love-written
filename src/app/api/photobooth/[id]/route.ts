import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { authorizeBooth, buildState, reconcile, touchPresence } from "@/lib/photobooth/session";
import { nudge } from "@/lib/photobooth/realtime";

type Ctx = { params: Promise<{ id: string }> };

// May build the photo strip in the background (after the response).
export const maxDuration = 60;

/**
 * The single source of truth for both browsers. Each read also records presence (so the
 * other person sees "connected") and nudges stuck sessions forward on the server.
 */
export const GET = route("photobooth_state", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req, { claimDevice: true });
  const announce = await touchPresence(booth, req);
  const changed = await reconcile(booth);
  const state = await buildState(changed ? await authorizeBooth(id, req) : booth);
  if (announce || changed) await nudge(booth.session.realtime_key);
  return NextResponse.json(state, { headers: { "cache-control": "no-store" } });
});
