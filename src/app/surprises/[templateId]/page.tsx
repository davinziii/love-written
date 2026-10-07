import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/ui/Brand";
import { CustomizeButton } from "@/components/catalog/CustomizeButton";
import { TrackView } from "@/components/ui/TrackView";
import { ResumeDraftBanner } from "@/components/catalog/ResumeDraftBanner";
import { SamplePreview } from "@/components/preview/SamplePreview";
import { MessageToOrderCTA } from "@/components/landing/OrderCTA";
import { GradientBlobs } from "@/components/landing/Decor";
import { Reveal } from "@/components/motion/Motion";
import { HeartIcon, Icon } from "@/components/ui/icons";
import { getTemplate, listedTemplates, type TemplateId } from "@/templates";
import { formatPeso } from "@/lib/format";
import { priceCentavos } from "@/lib/price";
import { isManualPayments } from "@/lib/payments/mode";

type Props = { params: Promise<{ templateId: string }> };

export function generateStaticParams() {
  return listedTemplates().map((t) => ({ templateId: t.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getTemplate((await params).templateId);
  return t ? { title: t.name, description: t.tagline } : {};
}

const MANUAL_STEPS = [
  { icon: Icon.message, text: "Message us with this template's name" },
  { icon: Icon.wallet, text: "Pay via GCash, Maya or bank transfer" },
  { icon: Icon.link, text: "Get your private link and create your surprise" },
];

/** Template tab: large live preview (desktop / mobile / full) + details and how to order. */
export default async function TemplatePage({ params }: Props) {
  const template = getTemplate((await params).templateId);
  if (!template || !template.listed) notFound();

  return (
    <>
      <TrackView event="template_selected" templateId={template.id} />
      <SiteHeader />
      {/* Full-width background: the blobs span the whole page, not just the content box. */}
      <div className="relative isolate overflow-x-clip">
        <GradientBlobs variant="soft" />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <ResumeDraftBanner templateId={template.id} />
        <nav className="mb-6 text-sm">
          <Link href="/surprises" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-ink-soft transition hover:bg-white/70 hover:text-ink">
            <Icon.arrowLeft size={15} /> All surprises
          </Link>
        </nav>

        <div className="grid items-start gap-10 lg:grid-cols-[1.45fr_1fr]">
          <section aria-label="Live example" className="rounded-[2rem] bg-white/60 p-4 ring-1 ring-line backdrop-blur sm:p-6">
            <SamplePreview templateId={template.id as TemplateId} defaultDevice="desktop" desktopHeight={560} phoneHeight={660} />
            <p className="mt-4 text-center text-sm text-ink-soft">A live example — tap, scroll and switch screens.</p>
          </section>

          <aside className="lg:sticky lg:top-24">
            <Reveal>
              <div className="rounded-[2rem] bg-paper p-7 shadow-[0_30px_60px_-40px_rgba(43,29,34,0.45)] ring-1 ring-line sm:p-9">
                <p className="inline-flex items-center gap-2 rounded-full bg-petal px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-rose">
                  <HeartIcon size={12} /> {template.category}
                </p>
                <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">{template.name}</h1>
                <p className="mt-4 leading-relaxed text-ink-soft">{template.description}</p>
                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                  {template.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-3 text-[0.95rem]">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose text-white">
                        <Icon.check size={11} strokeWidth={3} />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex items-baseline justify-between border-t border-line pt-6">
                  <span className="text-sm text-ink-soft">One-time · introductory price</span>
                  <span className="font-display text-4xl">{formatPeso(priceCentavos())}</span>
                </div>

                {isManualPayments ? (
                  <div className="mt-6">
                    <ol className="space-y-3">
                      {MANUAL_STEPS.map((s, i) => (
                        <li key={s.text} className="flex items-center gap-3 text-sm">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cream text-rose ring-1 ring-line">
                            <s.icon size={16} />
                          </span>
                          <span>
                            <span className="text-ink-soft">{i + 1}.</span> {s.text}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-6 [&>span]:w-full [&_a]:w-full">
                      <MessageToOrderCTA templateName={template.name} />
                    </div>
                    <p className="mt-4 text-center text-xs leading-relaxed text-ink-soft">
                      Already ordered? Open the private link we sent you, or{" "}
                      <Link href="/recover" className="text-rose underline underline-offset-2">
                        use your recovery code
                      </Link>
                      .
                    </p>
                  </div>
                ) : (
                  <>
                    <CustomizeButton templateId={template.id} className="mt-6" />
                    <p className="mt-4 text-center text-xs leading-relaxed text-ink-soft">
                      No account needed. You only pay after you&rsquo;ve previewed it.
                    </p>
                  </>
                )}
                <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
                  <Icon.clock size={13} /> Online for 30 days after it goes live
                </p>
              </div>
            </Reveal>
          </aside>
        </div>
        </main>
      </div>
      <SiteFooter />
    </>
  );
}
