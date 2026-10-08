import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/errors";
import { readJson } from "@/lib/security/request";
import { authorizeBooth, sendMessage } from "@/lib/photobooth/session";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ body: z.string().min(1).max(300), clientId: z.string().uuid() }).strict();

/** Send a chat message to the other person (rate-limited; retries are stored once). */
export const POST = route("photobooth_chat", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req);
  const input = await readJson(req, body);
  await sendMessage(booth, input.body, input.clientId);
  return NextResponse.json({ ok: true });
});
