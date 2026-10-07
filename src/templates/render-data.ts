import type { CustomerData } from "./schema";
import { isStyleField, type TemplateDefinition } from "./types";

/**
 * Merge stored customer data with resolved image URLs into the flat object a renderer
 * receives. Used by the studio preview (client) and the published page (server) so both
 * show exactly the same thing.
 */
export function buildRenderData(
  template: TemplateDefinition,
  data: CustomerData,
  imageUrls: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const field of template.fields) {
    if (field.type === "image") out[field.id] = imageUrls[field.id];
    // Each field is read only from its own bucket (style fields from style, the rest from content).
    else out[field.id] = isStyleField(field) ? data.style[field.id] : data.content[field.id];
  }
  return out;
}
