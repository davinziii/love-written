import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/errors";
import { EDIT_TOKEN_HEADER, idempotencyKeySchema, readJson } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { authorizeEdit } from "@/lib/surprises/repo";
import { createFailedPublishReport } from "@/lib/surprises/reports";

type Ctx = { params: Promise<{ id: string }> };

const body = z.object({
  idempotencyKey: idempotencyKeySchema,
  message: z.string().max(1000).optional(),
});

export const POST = route("report", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const row = await authorizeEdit(id, req.headers.get(EDIT_TOKEN_HEADER));
  await enforceRateLimit("report", row.id);
  const input = await readJson(req, body);
  const result = await createFailedPublishReport(row, input.idempotencyKey, input.message);
  return NextResponse.json(result, { status: 201 });
});
