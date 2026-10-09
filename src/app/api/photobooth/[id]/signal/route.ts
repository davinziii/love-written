import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/errors";
import { readJson } from "@/lib/security/request";
import { authorizeBooth, enforceBoothAction } from "@/lib/photobooth/session";
import { saveSignal } from "@/lib/photobooth/rtc";

type Ctx = { params: Promise<{ id: string }> };
const body = z
  .object({
    type: z.enum(["offer", "answer", "request", "pause"]),
    sdp: z.string().max(16_000).optional(),
    epoch: z.string().uuid(),
    reason: z.enum(["hello", "retry"]).optional(),
  })
  .strict();

/** Pass this person's live-view connection details to the other person. */
export const POST = route("photobooth_signal", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req);
  await enforceBoothAction(booth);
  await saveSignal(booth, await readJson(req, body));
  return NextResponse.json({ ok: true });
});
