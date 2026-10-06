import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { Errors, route } from "@/lib/errors";
import { EDIT_TOKEN_HEADER, readJson } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { canEdit, draftExpiryFrom, EDITABLE_STAGES, requiresStrictSave } from "@/lib/lifecycle";
import { authorizeEdit, getMedia, mediaFieldSet } from "@/lib/surprises/repo";
import { buildStudioState } from "@/lib/surprises/state";
import { getTemplate } from "@/templates";
import { validateCustomerData } from "@/templates/schema";

type Ctx = { params: Promise<{ id: string }> };

/** Load the customer's own surprise (edit token required). */
export const GET = route("load_draft", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const row = await authorizeEdit(id, req.headers.get(EDIT_TOKEN_HEADER));
  return NextResponse.json(await buildStudioState(row, { withMedia: true }));
});

const saveBody = z.object({
  content: z.record(z.string(), z.string().max(5000)),
  style: z.record(z.string(), z.string().max(64)),
  reveal: z
    .object({ mode: z.enum(["now", "schedule"]), scheduledFor: z.string().datetime({ offset: true }).nullable() })
    .optional(),
});

/** Autosave. Rejected once the surprise is live (also enforced by a database trigger). */
export const PATCH = route("save_draft", async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const row = await authorizeEdit(id, req.headers.get(EDIT_TOKEN_HEADER));
  await enforceRateLimit("saveDraft", row.id);
  if (!canEdit(row.stage)) throw Errors.locked();

  const input = await readJson(req, saveBody);
  const template = getTemplate(row.template_id);
  if (!template) throw Errors.badRequest("That template isn't available.");

  // Scheduled surprises must always stay publishable, so their saves are strict.
  const media = await getMedia(row.id);
  const result = validateCustomerData(template, input, {
    mode: requiresStrictSave(row.stage) ? "strict" : "draft",
    imageFieldsPresent: mediaFieldSet(media),
  });
  if (!result.ok) throw Errors.validation(result.errors);

  const update: Record<string, unknown> = {
    content: result.data.content,
    style: result.data.style,
    draft_expires_at: draftExpiryFrom(new Date()).toISOString(),
  };
  if (row.stage === "DRAFT") update.stage = "CUSTOMIZING";
  // Reveal timing of a scheduled surprise changes only through /publish (reschedule).
  if (input.reveal && row.stage !== "SCHEDULED") {
    update.reveal_mode = input.reveal.mode;
    update.scheduled_for = input.reveal.mode === "schedule" ? input.reveal.scheduledFor : null;
  }

  const { data, error } = await db()
    .from("surprises")
    .update(update)
    .eq("id", row.id)
    .in("stage", EDITABLE_STAGES as string[])
    .is("locked_at", null)
    .select("updated_at");
  if (error) throw new Error(`save: ${error.message}`);
  if (!data?.length) throw Errors.locked();

  return NextResponse.json({ savedAt: data[0]!.updated_at });
});
