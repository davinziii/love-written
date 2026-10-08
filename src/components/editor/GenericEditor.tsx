"use client";

import type { TemplateDefinition, FieldDef } from "@/templates/types";
import { isStyleField } from "@/templates/types";
import type { CustomerData } from "@/templates/schema";
import { FieldControl, isFieldVisible } from "./FieldControl";
import type { ImageState } from "./ImageFieldControl";
import { PhotoGrid } from "./PhotoGrid";

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
            {fields.map((field) => (
              <FieldControl
                key={field.id}
                field={field}
                value={isStyleField(field) ? data.style[field.id] : data.content[field.id]}
                image={images[field.id]}
                error={errors[field.id]}
                disabled={disabled}
                onChange={(v) => onFieldChange(field, v)}
                onImageSelect={(file) => onImageSelect(field, file)}
                onImageRemove={() => onImageRemove(field)}
              />
            ))}
          </div>
          )}
        </section>
      ))}
    </div>
  );
}

function groupFields(fields: readonly FieldDef[]): [string, FieldDef[]][] {
  const map = new Map<string, FieldDef[]>();
  for (const f of fields) map.set(f.group, [...(map.get(f.group) ?? []), f]);
  return [...map.entries()];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
