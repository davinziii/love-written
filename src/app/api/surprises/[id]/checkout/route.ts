import { NextResponse } from "next/server";
import { z } from "zod";
import { Errors, route } from "@/lib/errors";
import { isManualPayments } from "@/lib/payments/mode";
import { EDIT_TOKEN_HEADER, idempotencyKeySchema, ipKey, readJson } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { authorizeEdit } from "@/lib/surprises/repo";
import { startCheckout } from "@/lib/payments/checkout";

type Ctx = { params: Promise<{ id: string }> };

const body = z.object({ idempotencyKey: idempotencyKeySchema });

/** Create (or resume) the PayMongo checkout. Payment is confirmed only by the webhook. */
export const POST = route("checkout", async (req: Request, ctx: Ctx) => {
  if (isManualPayments) throw Errors.manualOrdersOnly();
  const { id } = await ctx.params;
  const row = await authorizeEdit(id, req.headers.get(EDIT_TOKEN_HEADER));
  await enforceRateLimit("checkout", row.id);
  await enforceRateLimit("checkout", ipKey(req.headers));
  const { idempotencyKey } = await readJson(req, body);

  const result = await startCheckout(row, idempotencyKey);
  return NextResponse.json(result);
});
