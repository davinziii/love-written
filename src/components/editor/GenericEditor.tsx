"use client";

import type { TemplateDefinition, FieldDef } from "@/templates/types";
import { isStyleField } from "@/templates/types";
import type { CustomerData } from "@/templates/schema";
import { FieldControl, isFieldVisible } from "./FieldControl";
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
              const control = (field: FieldDef) => (
                <FieldControl
                  key={field.id}
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
              // A photo followed by its text ("what happened") sits side by side.
              if (row.length === 2) {
                return (
                  <div key={row[0]!.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <div className="pt-7">{tile(row[0]!, "Photo")}</div>
                    {control(row[1]!)}
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

/** Pairs each photo with the textarea right after it; everything else is a row of one. */
function rows(fields: FieldDef[]): FieldDef[][] {
  const out: FieldDef[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]!;
    const next = fields[i + 1];
    if (f.type === "image" && next?.type === "textarea") {
      out.push([f, next]);
      i++;
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
