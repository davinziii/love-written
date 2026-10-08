import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/errors";
import { readJson } from "@/lib/security/request";
import { authorizeBooth, decide, enforceBoothAction } from "@/lib/photobooth/session";

type Ctx = { params: Promise<{ id: string }> };

// May build the photo strip in the background (after the response).
export const maxDuration = 60;
const body = z.object({ attempt: z.number().int().positive(), decision: z.enum(["KEEP", "RETAKE"]) });

/** Keep / Retake. A photo counts only when BOTH keep it; one retake redoes it for both. */
export const POST = route("photobooth_decide", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req);
  await enforceBoothAction(booth);
  const { attempt, decision } = await readJson(req, body);
  await decide(booth, attempt, decision);
  return NextResponse.json({ ok: true });
});
