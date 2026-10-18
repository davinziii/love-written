"use client";

/**
 * Renderer registry: template id → trusted React component.
 *
 * The type `Record<TemplateId, …>` means TypeScript refuses to compile if a template
 * in `index.ts` has no renderer registered here.
 *
 * Each renderer (with its CSS) is its own chunk, loaded only where that template is shown:
 * a recipient's page downloads one template, not all of them. Pages still render the
 * template on the server, and Next.js preloads the chunk it used.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { TemplateId } from "./index";
import type { RendererProps } from "./types";

export type RenderData = Record<string, string | undefined>;
type AnyRenderer = ComponentType<RendererProps<RenderData>>;

/**
 * Data reaching a renderer has already been validated against the same template's
 * schema (see `schema.ts`), so narrowing to the renderer's typed data happens once, here.
 */
function register<D>(renderer: ComponentType<RendererProps<D>>): AnyRenderer {
  return renderer as unknown as AnyRenderer;
}

const RENDERERS: Record<TemplateId, AnyRenderer> = {
  "our-story": dynamic(() => import("./our-story/OurStoryRenderer").then((m) => register(m.OurStoryRenderer))),
  "letter-for-you": dynamic(() => import("./letter-for-you/LetterForYouRenderer").then((m) => register(m.LetterForYouRenderer))),
  loveflix: dynamic(() => import("./loveflix/LoveflixRenderer").then((m) => register(m.LoveflixRenderer))),
  journal: dynamic(() => import("./journal/JournalRenderer").then((m) => register(m.JournalRenderer))),
  "cd-collection": dynamic(() => import("./cd-collection/CdCollectionRenderer").then((m) => register(m.CdCollectionRenderer))),
  "pixel-heart-hunt": dynamic(() => import("./pixel-heart-hunt/PixelHeartHuntRenderer").then((m) => register(m.PixelHeartHuntRenderer))),
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
