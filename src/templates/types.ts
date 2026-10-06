import type { FontId, ThemeId, TrackId } from "./styles";

/**
 * Field types the generic editor knows how to render.
 * Adding a new type means: add it here, teach `schema.ts` to validate it,
 * and teach `components/editor/FieldControl.tsx` to render a control for it.
 */
export type FieldType = "text" | "textarea" | "image" | "date" | "color" | "font" | "music";

/** Style fields are stored in `surprises.style`; everything else in `surprises.content`/`media`. */
export const STYLE_FIELD_TYPES = ["color", "font", "music"] as const;
export type StyleFieldType = (typeof STYLE_FIELD_TYPES)[number];

interface BaseField {
  /** Semantic, stable id (e.g. `final_message`). Never rename once customers have data. */
  id: string;
  label: string;
  /** Editor section heading this field is shown under. */
  group: string;
  help?: string;
  required?: boolean;
}

export interface TextField extends BaseField {
  type: "text";
  maxLength: number;
  placeholder?: string;
}

export interface TextareaField extends BaseField {
  type: "textarea";
  maxLength: number;
  rows?: number;
  placeholder?: string;
}

export interface ImageField extends BaseField {
  type: "image";
}

export interface DateField extends BaseField {
  type: "date";
}

export interface ColorField extends BaseField {
  type: "color";
  options: readonly ThemeId[];
  default: ThemeId;
}

export interface FontField extends BaseField {
  type: "font";
  options: readonly FontId[];
  default: FontId;
}

export interface MusicField extends BaseField {
  type: "music";
  /** Tracks from the Love, Written library. "none" is always allowed and is the default. */
  options: readonly TrackId[];
}

export type FieldDef =
  | TextField
  | TextareaField
  | ImageField
  | DateField
  | ColorField
  | FontField
  | MusicField;

export interface TemplateDefinition<F extends readonly FieldDef[] = readonly FieldDef[]> {
  /** URL-safe id; also the renderer registry key. */
  id: string;
  name: string;
  /** Short line for cards. */
  tagline: string;
  description: string;
  /** Occasion label shown on cards. */
  category: string;
  /** Bump when fields change incompatibly; stored on every surprise. */
  schemaVersion: number;
  /** Show in the public "Pick a Surprise" catalog. */
  listed: boolean;
  /** Optional text field used to name a surprise in lists (e.g. the recipient's name). */
  displayField?: string;
  /** What the customer gets — shown on the template page. */
  highlights: readonly string[];
  fields: F;
  /** Example data used for catalog previews. Image values are public URLs here. */
  sample: Record<string, string>;
}

/* ─── Type inference: field list → typed renderer data ─────────────────────── */

type AlwaysPresent<F> = F extends { required: true }
  ? true
  : F extends { type: StyleFieldType }
    ? true
    : false;

/**
 * The data a renderer receives, derived from its field list.
 * Required fields (and style fields, which always have defaults) are `string`;
 * optional fields are `string | undefined`. Image values are ready-to-use URLs.
 */
export type TemplateData<F extends readonly FieldDef[]> = {
  [K in F[number] as AlwaysPresent<K> extends true ? K["id"] : never]: string;
} & {
  [K in F[number] as AlwaysPresent<K> extends true ? never : K["id"]]?: string;
};

export interface RendererProps<D> {
  data: D;
  /** "preview" inside the studio / catalog, "live" on the recipient's link. */
  mode: "preview" | "live";
}

/** Identity helper that preserves literal field ids/flags for `TemplateData`. */
export function defineTemplate<const F extends readonly FieldDef[]>(
  def: TemplateDefinition<F>,
): TemplateDefinition<F> {
  return def;
}

export function isStyleField(field: FieldDef): field is ColorField | FontField | MusicField {
  return (STYLE_FIELD_TYPES as readonly string[]).includes(field.type);
}
