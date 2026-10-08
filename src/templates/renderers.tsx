/**
 * Renderer registry: template id → trusted React component.
 *
 * The type `Record<TemplateId, …>` means TypeScript refuses to compile if a template
 * in `index.ts` has no renderer registered here.
 */
import type { ComponentType } from "react";
import type { TemplateId } from "./index";
import type { RendererProps } from "./types";
import { OurStoryRenderer } from "./our-story/OurStoryRenderer";
import { LetterForYouRenderer } from "./letter-for-you/LetterForYouRenderer";

export type RenderData = Record<string, string | undefined>;
type AnyRenderer = ComponentType<RendererProps<RenderData>>;

/**
 * Data reaching a renderer has already been validated against the same template's
 * schema (see `schema.ts`), so narrowing to the renderer's typed data happens once, here.
 */
function register<D>(renderer: ComponentType<RendererProps<D>>): AnyRenderer {
  return renderer as unknown as AnyRenderer;
}

export const RENDERERS: Record<TemplateId, AnyRenderer> = {
  "our-story": register(OurStoryRenderer),
  "letter-for-you": register(LetterForYouRenderer),
};

export function TemplateExperience({
  templateId,
  data,
  mode,
}: {
  templateId: TemplateId;
  data: RenderData;
  mode: "preview" | "live";
}) {
  const Renderer = RENDERERS[templateId];
  return <Renderer data={data} mode={mode} />;
}
