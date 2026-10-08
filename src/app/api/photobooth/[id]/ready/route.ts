import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/errors";
import { readJson } from "@/lib/security/request";
import { authorizeBooth, enforceBoothAction, markReady } from "@/lib/photobooth/session";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ attempt: z.number().int().positive() });

/** "I'm ready". When both are, the server sets the shared shutter time. Repeat clicks are harmless. */
export const POST = route("photobooth_ready", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req);
  await enforceBoothAction(booth);
  const { attempt } = await readJson(req, body);
  await markReady(booth, attempt);
  return NextResponse.json({ ok: true });
});
