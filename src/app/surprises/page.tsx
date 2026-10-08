import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/ui/Brand";
import { PhoneFrame } from "@/components/preview/PhoneFrame";
import { ResumeDraftBanner } from "@/components/catalog/ResumeDraftBanner";
import { Eyebrow, GradientBlobs } from "@/components/landing/Decor";
import { PauseOffscreen, Reveal } from "@/components/motion/Motion";
import { HeartIcon, Icon } from "@/components/ui/icons";
import { TemplateExperience } from "@/templates/renderers";
import { listedTemplates, type TemplateId } from "@/templates";
import { formatPeso } from "@/lib/format";
import { priceCentavos } from "@/lib/price";

export const metadata: Metadata = { title: "Pick a Surprise" };

const COMING = ["Birthday Surprise", "Anniversary", "Best Friends"];

export default function CatalogPage() {
  const templates = listedTemplates();
  return (
    <>
      <SiteHeader />
      {/* Full-width background: the blobs span the whole page, not just the content box. */}
      <div className="relative isolate overflow-x-clip">
        <GradientBlobs variant="soft" />
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <ResumeDraftBanner />
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow icon={(p) => <HeartIcon {...p} />}>Pick a Surprise</Eyebrow>
          <h1 className="mt-5 font-display text-4xl tracking-tight sm:text-6xl">Choose how they&rsquo;ll feel it</h1>
          <p className="mt-4 text-lg text-ink-soft">Each surprise is a finished, interactive mini website. You bring the words and the photos.</p>
        </Reveal>

        <ul className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t, i) => (
            <Reveal as="li" key={t.id} delay={i * 90}>
              <article className="lw-lift group relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-paper ring-1 ring-line has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-rose">
                <PauseOffscreen className="relative bg-[radial-gradient(70%_60%_at_50%_30%,#f6d5dc,transparent_70%)] px-10 pt-8">
                  <div className="transition duration-500 [transition-timing-function:var(--ease-out-soft)] group-hover:-translate-y-2 group-hover:scale-[1.02]">
                    <PhoneFrame height={380} interactive={false} label={`${t.name} preview`}>
                      <TemplateExperience templateId={t.id as TemplateId} data={t.sample} mode="preview" />
                    </PhoneFrame>
                  </div>
                  <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium shadow-sm">
                    {formatPeso(priceCentavos())}
                  </span>
                </PauseOffscreen>
                <div className="flex flex-1 flex-col p-7">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose">{t.category}</p>
                  <h2 className="mt-2 font-display text-2xl">{t.name}</h2>
                  <p className="mt-2 flex-1 text-ink-soft">{t.tagline}</p>
                  {/* The ::after overlay makes the whole card clickable without nesting links. */}
                  <Link
                    href={`/surprises/${t.id}`}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-medium text-cream transition after:absolute after:inset-0 after:rounded-[2rem] after:content-[''] focus-visible:outline-none group-hover:bg-rose"
                  >
                    See {t.name}
                    <Icon.arrowRight size={17} className="transition group-hover:translate-x-1" />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
          <Reveal as="li" delay={templates.length * 90}>
            <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-line bg-white/40 p-8 text-center">
              <span className="lw-bob grid h-14 w-14 place-items-center rounded-2xl bg-petal text-rose">
                <Icon.sparkle size={26} />
              </span>
              <p className="mt-5 font-display text-2xl">More surprises soon</p>
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {COMING.map((c) => (
                  <li key={c} className="rounded-full bg-white px-3 py-1 text-xs text-ink-soft ring-1 ring-line">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </ul>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
