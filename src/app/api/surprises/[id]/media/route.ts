import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/admin";
import { Errors, route } from "@/lib/errors";
import { log, errorMessage } from "@/lib/log";
import { EDIT_TOKEN_HEADER, ipKey } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { canEdit, requiresStrictSave } from "@/lib/lifecycle";
import { authorizeEdit } from "@/lib/surprises/repo";
import { processImage } from "@/lib/media/process";
import { newMediaPath, putImage, removeObjects, signedUrls } from "@/lib/media/storage";
import { UPLOAD_RULES } from "@/lib/media/sniff";
import { track } from "@/lib/analytics/server";
import type { MediaRow, SurpriseRow } from "@/lib/db-types";
import { getTemplate } from "@/templates";

type Ctx = { params: Promise<{ id: string }> };

function imageField(row: SurpriseRow, fieldId: string | null) {
  const field = getTemplate(row.template_id)?.fields.find((f) => f.id === fieldId);
  if (!field || field.type !== "image") throw Errors.badRequest("That photo slot doesn't exist.");
  return field;
}

async function existingMedia(surpriseId: string, fieldId: string): Promise<MediaRow | null> {
  const { data } = await db().from("media").select("*").eq("surprise_id", surpriseId).eq("field_id", fieldId).maybeSingle();
  return data as MediaRow | null;
}

/** Upload (or replace) the photo for one image field. */
export const POST = route("upload_media", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const row = await authorizeEdit(id, req.headers.get(EDIT_TOKEN_HEADER));
  if (!canEdit(row.stage)) throw Errors.locked();
  await enforceRateLimit("upload", row.id);
  await enforceRateLimit("uploadPerIp", ipKey(req.headers));

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > UPLOAD_RULES.maxUploadBytes + 64 * 1024) {
    throw Errors.badRequest("That photo is too large. Please choose a smaller one.");
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const field = imageField(row, typeof form?.get("fieldId") === "string" ? (form!.get("fieldId") as string) : null);
  if (!(file instanceof File)) throw Errors.badRequest("Please choose a photo.");

  let processed;
  try {
    processed = await processImage(new Uint8Array(await file.arrayBuffer()));
  } catch (err) {
    await track("upload_failed", { templateId: row.template_id, surpriseId: row.id });
    throw err;
  }

  const path = newMediaPath(row.id);
  try {
    await putImage(path, processed.buffer);
  } catch (err) {
    log.error("upload_storage_failed", { surpriseId: row.id, error: errorMessage(err) });
    await track("upload_failed", { templateId: row.template_id, surpriseId: row.id });
    throw Errors.unavailable("We couldn't save that photo. Please try again.");
  }

  const previous = await existingMedia(row.id, field.id);
  const values = {
    storage_path: path,
    bytes: processed.bytes,
    width: processed.width,
    height: processed.height,
  };
  const { error } = previous
    ? await db().from("media").update(values).eq("id", previous.id)
    : await db().from("media").insert({ ...values, surprise_id: row.id, field_id: field.id });

  if (error) {
    // e.g. the surprise went live meanwhile (database trigger) — don't leave an orphan.
    await removeObjects([path]).catch(() => undefined);
    log.warn("media_row_rejected", { surpriseId: row.id, error: error.message });
    throw Errors.locked();
  }
  if (previous) {
    await removeObjects([previous.storage_path]).catch((err) =>
      log.warn("media_replace_cleanup_failed", { surpriseId: row.id, error: errorMessage(err) }),
    );
  }

  const url = (await signedUrls([path])).get(path) ?? null;
  return NextResponse.json({ fieldId: field.id, url, width: processed.width, height: processed.height });
});

/** Remove the photo from one image field. */
export const DELETE = route("delete_media", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const row = await authorizeEdit(id, req.headers.get(EDIT_TOKEN_HEADER));
  if (!canEdit(row.stage)) throw Errors.locked();
  await enforceRateLimit("upload", row.id);

  const field = imageField(row, new URL(req.url).searchParams.get("fieldId"));
  if (requiresStrictSave(row.stage) && field.required) {
    throw Errors.badRequest("This photo is required. Replace it instead of removing it.");
  }
  const previous = await existingMedia(row.id, field.id);
  if (!previous) return NextResponse.json({ removed: false });

  const { error } = await db().from("media").delete().eq("id", previous.id);
  if (error) throw Errors.locked();
  await removeObjects([previous.storage_path]).catch((err) =>
    log.warn("media_delete_cleanup_failed", { surpriseId: row.id, error: errorMessage(err) }),
  );
  return NextResponse.json({ removed: true });
});
