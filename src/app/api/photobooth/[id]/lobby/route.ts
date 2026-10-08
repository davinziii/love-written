import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/errors";
import { readJson } from "@/lib/security/request";
import { authorizeBooth, enforceBoothAction, lobbyUpdate } from "@/lib/photobooth/session";

type Ctx = { params: Promise<{ id: string }> };

const body = z
  .object({
    cameraReady: z.boolean().optional(),
    /** A camera problem (null clears it). Never fails the session — it's for the partner and support. */
    cameraIssue: z.enum(["denied", "unavailable", "in_use", "unsupported", "other"]).nullable().optional(),
    /** Must be literally true: the 7-day deletion notice was read and ticked. */
    acknowledge: z.boolean().optional(),
    frameId: z.string().min(1).max(64).optional(),
    /** What the other person sees you as. */
    displayName: z.string().max(60).optional(),
  })
  .strict();

/** Camera check, deletion notice and frame choice. Starts photo 1 once both people are set. */
export const POST = route("photobooth_lobby", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req);
  await enforceBoothAction(booth);
  await lobbyUpdate(booth, await readJson(req, body));
  return NextResponse.json({ ok: true });
});
