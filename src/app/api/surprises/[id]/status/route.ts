import { NextResponse } from "next/server";
import { route } from "@/lib/errors";
import { EDIT_TOKEN_HEADER } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { authorizeEdit } from "@/lib/surprises/repo";
import { buildStudioState } from "@/lib/surprises/state";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Lightweight polling endpoint (no media URLs) used while waiting for the PayMongo
 * webhook. It only reads our database — the browser's redirect is never trusted.
 */
export const GET = route("status", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const row = await authorizeEdit(id, req.headers.get(EDIT_TOKEN_HEADER));
  await enforceRateLimit("statusPoll", row.id, { failOpen: true });
  const state = await buildStudioState(row, { withMedia: false });
  return NextResponse.json(state);
});
