import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { authorizeBooth, enforceBoothAction } from "@/lib/photobooth/session";
import { iceServers } from "@/lib/photobooth/rtc";

type Ctx = { params: Promise<{ id: string }> };

/** Connection helpers (STUN, and short-lived TURN relay credentials) for the live view. */
export const GET = route("photobooth_ice", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req);
  await enforceBoothAction(booth);
  return NextResponse.json({ iceServers: await iceServers() }, { headers: { "cache-control": "no-store" } });
});
