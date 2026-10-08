/**
 * Template definition registry.
 *
 * Safe to import from both server and client code: it contains only data
 * (field schemas), never React components. Renderers are registered separately
 * in `renderers.tsx`.
 *
 * To add a template: import its definition and add it to TEMPLATES below.
 */
import type { TemplateDefinition } from "./types";
import { ourStoryDefinition } from "./our-story/definition";
import { letterForYouDefinition } from "./letter-for-you/definition";

export const TEMPLATES = {
  "our-story": ourStoryDefinition,
  "letter-for-you": letterForYouDefinition,
} as const satisfies Record<string, TemplateDefinition>;

export type TemplateId = keyof typeof TEMPLATES;

// Registry keys must match each definition's id.
for (const [key, def] of Object.entries(TEMPLATES)) {
  if (key !== def.id) throw new Error(`Template registry key "${key}" does not match id "${def.id}"`);
}

export function getTemplate(id: string): TemplateDefinition | undefined {
  return (TEMPLATES as Record<string, TemplateDefinition>)[id];
}

export function isTemplateId(id: string): id is TemplateId {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, id);
}

/** Templates shown in the public catalog, in display order. */
export function listedTemplates(): TemplateDefinition[] {
  return Object.values(TEMPLATES as Record<string, TemplateDefinition>).filter((t) => t.listed);
}
