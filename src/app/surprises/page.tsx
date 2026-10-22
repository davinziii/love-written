import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/ui/Brand";
import { ResumeDraftBanner } from "@/components/catalog/ResumeDraftBanner";
import { CatalogGrid, type CatalogItem } from "@/components/catalog/CatalogGrid";
import { Eyebrow } from "@/components/landing/Decor";
import { HeartIcon } from "@/components/ui/icons";
import { listedTemplates } from "@/templates";

export const metadata: Metadata = { title: "Pick a Surprise" };

const COMING = ["Birthday Surprise", "Anniversary", "Best Friends"];

/** How many photos a template takes: "5", or "8–30" when some are optional. */
function photoRange(fields: readonly { type: string; required?: boolean }[]): string {
  const images = fields.filter((f) => f.type === "image");
  const min = images.filter((f) => f.required).length;
  return min === images.length ? String(min) : `${min}–${images.length}`;
}

/** The catalog: still covers in compact cards (no live previews, no animation), in price order. */
export default function CatalogPage() {
  const items: CatalogItem[] = listedTemplates().map((t) => ({
    id: t.id,
    name: t.name,
    collection: t.collection,
    priceCentavos: t.priceCentavos,
    photos: photoRange(t.fields),
  }));
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <ResumeDraftBanner />
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow icon={(p) => <HeartIcon {...p} />}>Pick a Surprise</Eyebrow>
          <h1 className="mt-5 font-display text-4xl tracking-tight sm:text-5xl">Choose how they&rsquo;ll feel it</h1>
          <p className="mt-3 text-ink-soft">Each surprise is a finished, interactive mini website. You bring the words and the photos.</p>
        </div>
        <CatalogGrid items={items} comingSoon={COMING} />
      </main>
      <SiteFooter />
    </>
  );
}
