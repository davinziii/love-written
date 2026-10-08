import { NextResponse } from "next/server";
import { Errors, route } from "@/lib/errors";
import { authorizeBooth, saveShot } from "@/lib/photobooth/session";

type Ctx = { params: Promise<{ id: string }> };
const MAX_BODY = 5 * 1024 * 1024;

/** Upload this person's still for the current attempt (never video). Retries overwrite. */
export const POST = route("photobooth_shot", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const booth = await authorizeBooth(id, req);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) throw Errors.badRequest("That photo is too large.");

  const form = await req.formData().catch(() => null);
  const attempt = Number(form?.get("attempt"));
  const file = form?.get("file");
  if (!Number.isInteger(attempt) || attempt < 1 || !(file instanceof File)) throw Errors.badRequest();
  await saveShot(booth, attempt, new Uint8Array(await file.arrayBuffer()));
  return NextResponse.json({ ok: true });
});
