import { NextResponse } from "next/server";
import { Errors, route } from "@/lib/errors";
import { authorizeBooth, enforceBoothAction, retryFinalize } from "@/lib/photobooth/session";

type Ctx = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/** "Try again" when building the strip failed. The session (and payment) stay safe. */
export const POST = route("photobooth_finalize", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req);
  await enforceBoothAction(booth);
  if (booth.session.status !== "FINALIZATION_FAILED" && booth.session.status !== "GENERATING") {
    throw Errors.conflict("BOOTH_STALE", "Your photobooth is already finished.");
  }
  await retryFinalize(id);
  return NextResponse.json({ ok: true });
});
