import { NextResponse } from "next/server";
import { z } from "zod";
import { Errors, route } from "@/lib/errors";
import { idempotencyKeySchema, readJson } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { authorizeBooth } from "@/lib/photobooth/session";
import { startBoothCheckout } from "@/lib/photobooth/payments";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ idempotencyKey: idempotencyKeySchema });

/** Person A resumes payment (e.g. after cancelling on PayMongo). Person B never pays. */
export const POST = route("photobooth_checkout", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req);
  if (booth.me.role !== "A") throw Errors.badRequest("Only the person who created this photobooth pays for it.");
  const input = await readJson(req, body);
  await enforceRateLimit("boothCheckout", booth.session.id);
  const result = await startBoothCheckout(booth.session, input.idempotencyKey);
  return NextResponse.json(result);
});
