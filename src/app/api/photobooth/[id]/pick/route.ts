import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/errors";
import { readJson } from "@/lib/security/request";
import { authorizeBooth, enforceBoothAction, savePick } from "@/lib/photobooth/session";

type Ctx = { params: Promise<{ id: string }> };

// May start building the strip in the background (after the response).
export const maxDuration = 60;

const body = z
  .object({
    frameId: z.string().min(1).max(64).optional(),
    filter: z.enum(["bw", "color"]).optional(),
    confirm: z.boolean(),
  })
  .strict();

/** Pick the strip's look (filter + frame). Made when both people confirm the same look. */
export const POST = route("photobooth_pick", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req);
  await enforceBoothAction(booth);
  await savePick(booth, await readJson(req, body));
  return NextResponse.json({ ok: true });
});
