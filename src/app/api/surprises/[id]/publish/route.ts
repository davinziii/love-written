import { NextResponse } from "next/server";
import { z } from "zod";
import { route } from "@/lib/errors";
import { EDIT_TOKEN_HEADER, idempotencyKeySchema, readJson } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { authorizeEdit } from "@/lib/surprises/repo";
import { assertPublishable, publishSurprise } from "@/lib/surprises/publish";

type Ctx = { params: Promise<{ id: string }> };

const body = z.object({
  idempotencyKey: idempotencyKeySchema,
  mode: z.enum(["now", "schedule"]),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
});

/** Publish now, schedule, reschedule, or "Try again" after a failure. Never charges. */
export const POST = route("publish", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const row = await authorizeEdit(id, req.headers.get(EDIT_TOKEN_HEADER));
  await enforceRateLimit("publish", row.id);
  const input = await readJson(req, body);
  const scheduledFor = input.mode === "schedule" && input.scheduledFor ? new Date(input.scheduledFor) : undefined;

  await assertPublishable(row, input.mode, scheduledFor);
  const result = await publishSurprise({
    surpriseId: row.id,
    idempotencyKey: input.idempotencyKey,
    mode: input.mode,
    scheduledFor,
    source: "customer",
  });
  return NextResponse.json(result);
});
