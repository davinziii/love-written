import { z } from "zod";
import { isStyleField, type FieldDef, type TemplateDefinition } from "./types";
import { MUSIC_LIBRARY, NO_MUSIC } from "./styles";

/**
 * Generic, schema-driven validation of customer data.
 *
 * Works for every template — nothing here knows about "Our Story".
 *   draft  — types and lengths are enforced, required fields may still be empty
 *   strict — additionally every required field must be present (checkout / publish)
 *
 * Image fields are not stored in `content`: they live in the `media` table, one row per
 * field. Callers pass the set of image field ids that currently have media.
 */
export type ValidationMode = "draft" | "strict";

export interface CustomerData {
  content: Record<string, string>;
  style: Record<string, string>;
}

export interface ValidationResult {
  ok: boolean;
  data: CustomerData;
  /** field id → human-readable problem */
  errors: Record<string, string>;
}

// Strip control characters (except newline/tab in long text) and normalize line endings.
function cleanText(value: string, multiline: boolean): string {
  const normalized = value.normalize("NFC").replace(/\r\n?/g, "\n");
  const stripped = multiline
    ? normalized.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    : normalized.replace(/[\u0000-\u001F\u007F]/g, " ");
  return stripped.replace(/\n{4,}/g, "\n\n\n").trim();
}

const charCount = (s: string) => Array.from(s).length;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    const y = d.getUTCFullYear();
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s) && y >= 1900 && y <= 2100;
  }, "Use a valid date");

/** Zod schema for one non-image field's value (already known to be non-empty). */
export function fieldValueSchema(field: FieldDef): z.ZodType<string> {
  switch (field.type) {
    case "text":
    case "textarea": {
      const multiline = field.type === "textarea";
      return z
        .string()
        .transform((s) => cleanText(s, multiline))
        .refine((s) => charCount(s) <= field.maxLength, `Keep this under ${field.maxLength} characters`);
    }
    case "date":
      return isoDate;
    case "color":
    case "font":
      return z.string().refine((v) => (field.options as readonly string[]).includes(v), "Choose one of the options");
    case "music":
      return z
        .string()
        .refine(
          (v) =>
            v === NO_MUSIC ||
            ((field.options as readonly string[]).includes(v) &&
              MUSIC_LIBRARY.some((t: { id: string }) => t.id === v)),
          "Choose a track from the library",
        );
    case "image":
      return z.never();
  }
}

function styleDefault(field: FieldDef): string | undefined {
  if (field.type === "color" || field.type === "font") return field.default;
  if (field.type === "music") return NO_MUSIC;
  return undefined;
}

export function validateCustomerData(
  template: TemplateDefinition,
  input: { content?: unknown; style?: unknown },
  opts: { mode: ValidationMode; imageFieldsPresent: ReadonlySet<string> },
): ValidationResult {
  const rawContent = isRecord(input.content) ? input.content : {};
  const rawStyle = isRecord(input.style) ? input.style : {};
  const data: CustomerData = { content: {}, style: {} };
  const errors: Record<string, string> = {};

  for (const field of template.fields) {
    if (field.type === "image") {
      if (opts.mode === "strict" && field.required && !opts.imageFieldsPresent.has(field.id)) {
        errors[field.id] = "Please add a photo";
      }
      continue;
    }

    const bucket = isStyleField(field) ? data.style : data.content;
    const raw = (isStyleField(field) ? rawStyle : rawContent)[field.id];
    const isEmpty = raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");

    if (isEmpty) {
      const fallback = styleDefault(field);
      if (fallback !== undefined) bucket[field.id] = fallback;
      else if (opts.mode === "strict" && field.required) errors[field.id] = "This is required";
      continue;
    }

    if (typeof raw !== "string") {
      errors[field.id] = "Invalid value";
      continue;
    }

    const parsed = fieldValueSchema(field).safeParse(raw);
    if (!parsed.success) {
      errors[field.id] = parsed.error.issues[0]?.message ?? "Invalid value";
      continue;
    }
    if (parsed.data === "") {
      if (opts.mode === "strict" && field.required) errors[field.id] = "This is required";
      continue;
    }
    bucket[field.id] = parsed.data;
  }

  return { ok: Object.keys(errors).length === 0, data, errors };
}

/** Required fields that are still empty — drives the editor's "missing" list. */
export function missingRequiredFields(
  template: TemplateDefinition,
  data: CustomerData,
  imageFieldsPresent: ReadonlySet<string>,
): FieldDef[] {
  return template.fields.filter((f) => {
    if (!f.required) return false;
    if (f.type === "image") return !imageFieldsPresent.has(f.id);
    const bucket = isStyleField(f) ? data.style : data.content;
    return !bucket[f.id]?.trim();
  });
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
