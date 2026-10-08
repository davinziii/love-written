"use client";

import type { TemplateDefinition, FieldDef } from "@/templates/types";
import { isStyleField } from "@/templates/types";
import type { CustomerData } from "@/templates/schema";
import { FieldControl, isFieldVisible, type FieldControlProps } from "./FieldControl";
import type { ImageState } from "./ImageFieldControl";
import { PhotoGrid, PhotoTile } from "./PhotoGrid";

/**
 * The generic, schema-driven editor. It reads `template.fields`, groups them by
 * `field.group`, and renders one control per field type. It has no idea which template
 * it is editing — that is the point.
 */
export function GenericEditor({
  template,
  data,
  images,
  errors,
  disabled,
  onFieldChange,
  onImageSelect,
  onImageRemove,
}: {
  template: TemplateDefinition;
  data: CustomerData;
  images: Record<string, ImageState>;
  errors: Record<string, string>;
  disabled?: boolean;
  onFieldChange: (field: FieldDef, value: string) => void;
  onImageSelect: (field: FieldDef, file: File) => void;
  onImageRemove: (field: FieldDef) => void;
}) {
  const groups = groupFields(template.fields.filter(isFieldVisible));

  return (
    <div className="space-y-6">
      {groups.map(([group, fields]) => (
        <section key={group} className="rounded-[1.75rem] bg-paper p-5 ring-1 ring-line sm:p-7" aria-labelledby={`group-${slug(group)}`}>
          <h2 id={`group-${slug(group)}`} className="font-display text-xl">
            {group}
          </h2>
          {fields.length > 1 && fields.every((f) => f.type === "image") ? (
            <div className="mt-4">
              <PhotoGrid
                fields={fields}
                images={images}
                errors={errors}
                disabled={disabled}
                onSelect={onImageSelect}
                onRemove={onImageRemove}
              />
            </div>
          ) : (
          <div className="mt-5 space-y-6">
            {rows(fields).map((row) => {
              const control = (field: FieldDef, extra?: Pick<FieldControlProps, "label" | "variant">) => (
                <FieldControl
                  key={field.id}
                  {...extra}
                  field={field}
                  value={isStyleField(field) ? data.style[field.id] : data.content[field.id]}
                  error={errors[field.id]}
                  disabled={disabled}
                  onChange={(v) => onFieldChange(field, v)}
                  onImageSelect={(file) => onImageSelect(field, file)}
                  onImageRemove={() => onImageRemove(field)}
                />
              );
              const tile = (field: FieldDef, caption?: string) => (
                <PhotoTile
                  field={field}
                  caption={caption}
                  state={images[field.id]}
                  error={errors[field.id]}
                  disabled={disabled}
                  onSelect={(file) => onImageSelect(field, file)}
                  onDrop={(files) => files[0] && onImageSelect(field, files[0])}
                  onRemove={() => onImageRemove(field)}
                />
              );
              // A memory. Wider screens: photo with its date underneath on the left, "what happened"
              // on the right, both starting with a one-line label so the boxes line up.
              // Phones: photo and date side by side, the text full width below.
              if (row.length > 1) {
                const [photo, text, date] = row as [FieldDef, FieldDef, FieldDef | undefined];
                // "First memory — what happened" → heading "First memory", label "What happened",
                // so both columns get one-line labels that line up.
                const [title, rest] = text.label.includes(" — ") ? text.label.split(" — ", 2) : [null, text.label];
                const textLabel = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : text.label;
                return (
                  <div
                    key={photo.id}
                    className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 border-t border-line/70 pt-6 first:border-0 first:pt-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-5"
                  >
                    {title && <h3 className="col-span-2 -mb-2 font-display text-lg leading-tight">{title}</h3>}
                    <div className="col-start-1 row-start-2 space-y-2">
                      <p className="flex min-h-7 items-center text-sm font-medium text-ink">
                        Photo
                        {photo.required ? <span className="text-rose">&nbsp;*</span> : <span className="font-normal text-ink-soft">&nbsp;(optional)</span>}
                      </p>
                      {tile(photo, "")}
                    </div>
                    {date && (
                      <div className="col-start-2 row-start-2 sm:col-start-1 sm:row-start-3">
                        {control(date, { label: "Date", variant: "compact" })}
                      </div>
                    )}
                    <div className={`col-span-2 row-start-3 sm:col-span-1 sm:col-start-2 sm:row-start-2 ${date ? "sm:row-span-2" : ""}`}>
                      {control(text, { label: textLabel, variant: "fill" })}
                    </div>
                  </div>
                );
              }
              const field = row[0]!;
              return field.type === "image" ? (
                <div key={field.id} className="w-32">
                  {tile(field)}
                </div>
              ) : (
                control(field)
              );
            })}
          </div>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * Groups a photo with the textarea right after it (and a date right after that, if any)
 * into one "memory" row; everything else is a row of one.
 */
function rows(fields: FieldDef[]): FieldDef[][] {
  const out: FieldDef[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]!;
    if (f.type === "image" && fields[i + 1]?.type === "textarea") {
      const withDate = fields[i + 2]?.type === "date";
      out.push(fields.slice(i, i + (withDate ? 3 : 2)));
      i += withDate ? 2 : 1;
    } else out.push([f]);
  }
  return out;
}

function groupFields(fields: readonly FieldDef[]): [string, FieldDef[]][] {
  const map = new Map<string, FieldDef[]>();
  for (const f of fields) map.set(f.group, [...(map.get(f.group) ?? []), f]);
  return [...map.entries()];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
