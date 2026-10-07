import type { CSSProperties } from "react";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/ui/Brand";
import { TrackView } from "@/components/ui/TrackView";
import { HeartIcon, Icon } from "@/components/ui/icons";
import { Reveal, PauseOffscreen } from "@/components/motion/Motion";
import { AnimatedHeadline, Eyebrow, FloatingHearts, GradientBlobs, Sparkle, TypedLine } from "@/components/landing/Decor";
import { HeroDevices } from "@/components/landing/HeroDevices";
import { MessageToOrderCTA, PickSurpriseCTA, ctaClasses } from "@/components/landing/OrderCTA";
import { FAQ_TEASER, HOW_IT_WORKS } from "@/components/landing/content";
import { SamplePreview } from "@/components/preview/SamplePreview";
import { ourStoryDefinition } from "@/templates/our-story/definition";
import { THEMES } from "@/templates/styles";
import { formatPeso } from "@/lib/format";
import { priceCentavos } from "@/lib/price";
import { isManualPayments } from "@/lib/payments/mode";

const PROMISES = [
  { icon: Icon.lock, title: "A private link", body: "Each surprise lives at its own long, unguessable link — not listed anywhere." },
  { icon: Icon.eyeOff, title: "Not on Google", body: "Surprise pages tell search engines not to index or archive them." },
  { icon: Icon.image, title: "Private photos", body: "Photos are stored privately, shown only through short-lived secure links, with location data removed." },
  { icon: Icon.clock, title: "Gone after 30 days", body: "Online for 30 days after it goes live, then its photos and messages are deleted." },
];

/** Photo stack that fans out when its card is hovered. */
const FAN = [
  "-rotate-[8deg] group-hover:-translate-x-5 group-hover:-rotate-[16deg]",
  "rotate-0 group-hover:-translate-y-2",
  "rotate-[8deg] group-hover:translate-x-5 group-hover:rotate-[16deg]",
];

export default function LandingPage() {
  const sample = ourStoryDefinition.sample;
  const price = formatPeso(priceCentavos());

  return (
    <>
      <TrackView event="landing_view" />
      <SiteHeader />
      <main className="overflow-x-clip">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <section className="relative isolate">
          <GradientBlobs />
          <PauseOffscreen className="absolute inset-0 -z-10">
            <FloatingHearts />
            <Sparkle style={{ top: "18%", left: "8%" }} delay="0.4s" />
            <Sparkle style={{ top: "12%", left: "47%" }} size={14} delay="1.6s" />
            <Sparkle style={{ top: "72%", left: "44%" }} size={12} delay="2.4s" />
          </PauseOffscreen>

          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-14 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:pb-28 lg:pt-20">
            <div className="text-center lg:text-left">
              <div className="animate-fade-up">
                <Eyebrow icon={(p) => <HeartIcon {...p} />}>Digital love letters</Eyebrow>
              </div>
              <AnimatedHeadline
                text="Create a surprise they'll never forget."
                highlight="never forget"
                className="mt-6 font-display text-[2.9rem] leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.6rem]"
              />
              <div className="mt-5">
                <TypedLine text="For Samantha, from Vinz ♥" />
              </div>
              <p
                className="animate-fade-up mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-soft lg:mx-0"
                style={{ animationDelay: "1.1s" } as CSSProperties}
              >
                Your photos and words, turned into a private, interactive mini website — opened like a letter, revealed with
                one link. No design skills. No account.
              </p>
              <div
                className="animate-fade-up mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
                style={{ animationDelay: "1.3s" } as CSSProperties}
              >
                <PickSurpriseCTA />
                <a href="#how-it-works" className={ctaClasses.secondary}>
                  How it works
                </a>
              </div>
              <p
                className="animate-fade-up mt-5 text-sm text-ink-soft"
                style={{ animationDelay: "1.5s" } as CSSProperties}
              >
                <span className="font-medium text-ink">{price}</span> · introductory price · online for 30 days
              </p>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: "0.5s" } as CSSProperties}>
              <HeroDevices templateId="our-story" data={sample} />
            </div>
          </div>
        </section>

        {/* ─── What you're giving (bento) ───────────────────────────── */}
        <section className="relative border-y border-line/60 bg-paper py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <Eyebrow icon={Icon.gift}>What you&rsquo;re giving</Eyebrow>
              <h2 className="mt-5 font-display text-4xl tracking-tight sm:text-5xl">Not a card. A little world, just for them.</h2>
              <p className="mt-4 text-lg text-ink-soft">Every surprise is a finished, designed experience. You bring the words and the photos.</p>
            </Reveal>

            <div className="mt-14 grid gap-5 md:grid-cols-6">
              <Reveal className="md:col-span-3 md:row-span-2" delay={0}>
                <article className="lw-lift group relative flex h-full min-h-80 flex-col overflow-hidden rounded-[2rem] bg-[linear-gradient(160deg,#fde8ec,#fbf1ee_60%)] p-8 ring-1 ring-blush">
                  <FeatureLabel icon={Icon.envelope}>Opens like a sealed letter</FeatureLabel>
                  <p className="mt-3 max-w-sm text-ink-soft">Their name on the envelope. One tap breaks the seal and the story begins.</p>
                  <div className="relative mt-auto flex justify-center pt-10">
                    <MiniEnvelope />
                  </div>
                </article>
              </Reveal>

              <Reveal className="md:col-span-3" delay={100}>
                <article className="lw-lift group flex h-full items-center gap-6 overflow-hidden rounded-[2rem] bg-cream p-7 ring-1 ring-line">
                  <div className="relative h-28 w-28 shrink-0">
                    {[sample.memory_photo_3, sample.memory_photo_2, sample.memory_photo_1].map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className={`absolute inset-0 h-28 w-24 rounded-md bg-white object-cover p-1.5 pb-4 shadow-md transition duration-500 [transition-timing-function:var(--ease-out-soft)] ${FAN[i]}`}
                      />
                    ))}
                  </div>
                  <div>
                    <FeatureLabel icon={Icon.image}>Your memories, as chapters</FeatureLabel>
                    <p className="mt-2 text-ink-soft">Up to three photo moments, each with its own little story and date.</p>
                  </div>
                </article>
              </Reveal>

              <Reveal className="md:col-span-3" delay={180}>
                <article className="lw-lift flex h-full items-center gap-6 overflow-hidden rounded-[2rem] bg-ink p-7 text-cream">
                  <span className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full bg-rose text-white">
                    <span className="lw-bob" style={{ "--t": "2.4s" } as CSSProperties}>
                      <HeartIcon size={34} />
                    </span>
                    <span className="absolute inset-0 animate-ping rounded-full bg-rose/40 [animation-duration:2.4s] motion-reduce:hidden" />
                  </span>
                  <div>
                    <FeatureLabel icon={Icon.sparkle} dark>
                      A final reveal
                    </FeatureLabel>
                    <p className="mt-2 text-cream/70">The last message stays hidden until they tap the heart.</p>
                  </div>
                </article>
              </Reveal>

              <Reveal className="md:col-span-2" delay={60}>
                <article className="lw-lift h-full rounded-[2rem] bg-white p-7 ring-1 ring-line">
                  <FeatureLabel icon={Icon.monitor}>Every screen</FeatureLabel>
                  <p className="mt-2 text-sm text-ink-soft">Designed for phones first, and beautiful on laptops and tablets too.</p>
                </article>
              </Reveal>
              <Reveal className="md:col-span-2" delay={120}>
                <article className="lw-lift h-full rounded-[2rem] bg-white p-7 ring-1 ring-line">
                  <FeatureLabel icon={Icon.sparkle}>Your style</FeatureLabel>
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Ten color themes">
                    {Object.values(THEMES).map((t) => (
                      <span key={t.id} title={t.label} className="grid h-8 w-8 place-items-center rounded-full ring-1 ring-black/5 transition hover:scale-110" style={{ background: t.bg }}>
                        <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.accent }} />
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-ink-soft">Ten color themes, plus fonts for your story and your final message.</p>
                </article>
              </Reveal>
              <Reveal className="md:col-span-2" delay={180}>
                <article className="lw-lift h-full rounded-[2rem] bg-white p-7 ring-1 ring-line">
                  <FeatureLabel icon={Icon.calendar}>Perfect timing</FeatureLabel>
                  <p className="mt-2 text-sm text-ink-soft">Reveal it now, or schedule it for midnight on their birthday.</p>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ─── Live preview ─────────────────────────────────────────── */}
        <section className="relative isolate py-24">
          <GradientBlobs variant="soft" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <Reveal>
              <Eyebrow icon={Icon.eye}>Try it yourself</Eyebrow>
              <h2 className="mt-5 font-display text-4xl tracking-tight sm:text-5xl">See it on every screen</h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                This is a real surprise, running live. Switch between laptop and phone, open the letter, scroll the memories
                and tap the heart.
              </p>
              <ul className="mt-6 space-y-3 text-ink-soft">
                {["Built for phones first", "A proper wide layout on laptops", "Smooth, light animations"].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-petal text-rose">
                      <Icon.check size={14} strokeWidth={2.6} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120}>
              <SamplePreview templateId="our-story" defaultDevice="desktop" desktopHeight={500} phoneHeight={600} />
            </Reveal>
          </div>
        </section>

        {/* ─── How it works ─────────────────────────────────────────── */}
        <section id="how-it-works" className="scroll-mt-20 bg-paper py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <Eyebrow icon={Icon.book}>How it works</Eyebrow>
              <h2 className="mt-5 font-display text-4xl tracking-tight sm:text-5xl">From your heart to their screen</h2>
              {isManualPayments && (
                <p className="mt-4 text-lg text-ink-soft">For now, every order is handled personally — just send us a message.</p>
              )}
            </Reveal>
            <ol className={`relative mt-14 grid gap-5 sm:grid-cols-2 ${HOW_IT_WORKS.length > 4 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
              {HOW_IT_WORKS.map((step, i) => {
                const Glyph = Icon[step.icon];
                return (
                  <Reveal as="li" key={step.title} delay={i * 80}>
                    <div className="lw-lift group relative h-full rounded-[1.75rem] bg-cream p-6 ring-1 ring-line">
                      <div className="flex items-center justify-between">
                        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-rose shadow-sm ring-1 ring-blush transition duration-300 group-hover:-rotate-6 group-hover:scale-110">
                          <Glyph size={22} />
                        </span>
                        <span className="font-display text-4xl text-blush">{String(i + 1).padStart(2, "0")}</span>
                      </div>
                      <h3 className="mt-5 font-display text-xl">{step.title}</h3>
                      <p className="mt-2 leading-relaxed text-ink-soft">{step.body}</p>
                    </div>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </section>

        {/* ─── Privacy ──────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden bg-ink py-24 text-cream">
          <div aria-hidden className="absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-rose/25 blur-3xl" />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <Reveal>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blush">
                <Icon.shield size={14} /> Personal by design
              </p>
              <h2 className="mt-5 font-display text-4xl tracking-tight sm:text-5xl">What you write is meant for one person.</h2>
              <p className="mt-4 text-lg text-cream/70">We built Love, Written to keep it that way — from the link to the last photo.</p>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {PROMISES.map((p, i) => (
                <Reveal key={p.title} delay={i * 90}>
                  <div className="h-full rounded-[1.5rem] bg-white/[0.06] p-6 ring-1 ring-white/10 transition duration-300 hover:bg-white/[0.09]">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose/20 text-blush">
                      <p.icon size={20} />
                    </span>
                    <h3 className="mt-4 font-display text-xl">{p.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-cream/65">{p.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Price ────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <Reveal>
            <div className="relative isolate grid overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#fbe9ec_0%,#fffdfa_55%,#fdeee2_100%)] ring-1 ring-blush lg:grid-cols-[1fr_1fr]">
              <PauseOffscreen className="absolute inset-0 -z-10">
                <FloatingHearts />
              </PauseOffscreen>
              <div className="p-8 sm:p-12">
                <Eyebrow icon={Icon.gift}>Introductory price</Eyebrow>
                <p className="mt-6 font-display text-7xl tracking-tight">{price}</p>
                <p className="mt-2 text-ink-soft">One surprise · one payment · online for 30 days after it goes live</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  {isManualPayments ? <MessageToOrderCTA /> : <PickSurpriseCTA label="Start your surprise" />}
                  <Link href="/surprises" className={ctaClasses.secondary}>
                    Browse templates
                  </Link>
                </div>
              </div>
              <ul className="space-y-4 border-t border-blush/70 bg-white/50 p-8 backdrop-blur sm:p-12 lg:border-l lg:border-t-0">
                {[
                  "Preview it on laptop and phone before it goes live",
                  "Publish now or schedule the reveal",
                  isManualPayments ? "Pay with GCash, Maya or bank transfer" : "Pay with GCash, Maya, QR Ph or card",
                  "No account needed — a recovery code keeps it safe",
                  "Private link, never indexed by search engines",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose text-white">
                      <Icon.check size={13} strokeWidth={3} />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* ─── FAQ teaser ───────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-4 pb-28 sm:px-6">
          <Reveal className="text-center">
            <h2 className="font-display text-4xl tracking-tight">Good to know</h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQ_TEASER.map((f, i) => (
              <Reveal key={f.q} delay={i * 70}>
                <details className="group rounded-2xl bg-paper px-6 py-5 ring-1 ring-line transition open:shadow-[0_20px_40px_-28px_rgba(43,29,34,0.35)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {f.q}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-petal text-rose transition duration-300 group-open:rotate-45" aria-hidden>
                      <Icon.plus size={15} />
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-ink-soft">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link href="/faq" className="text-rose underline decoration-rose/30 underline-offset-4 hover:decoration-rose">
              Read all questions →
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function FeatureLabel({ icon: Glyph, children, dark = false }: { icon: (p: { size?: number }) => React.ReactNode; children: React.ReactNode; dark?: boolean }) {
  return (
    <h3 className="flex items-center gap-2.5 font-display text-2xl">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${dark ? "bg-white/10 text-blush" : "bg-white text-rose shadow-sm ring-1 ring-blush"}`}>
        <Glyph size={18} />
      </span>
      {children}
    </h3>
  );
}

/** Envelope illustration whose seal lifts when the card is hovered. */
function MiniEnvelope() {
  return (
    <div className="relative w-64 transition duration-500 [transition-timing-function:var(--ease-out-soft)] group-hover:-translate-y-2">
      <svg viewBox="0 0 220 150" className="w-full drop-shadow-[0_20px_30px_rgba(43,29,34,0.18)]" aria-hidden>
        <rect x="4" y="10" width="212" height="136" rx="10" fill="#fff" />
        <path d="M4 20 L110 92 L216 20" fill="none" stroke="#f6c9d2" strokeWidth="3" />
        <path d="M4 146 L86 76 M216 146 L134 76" stroke="#f6c9d2" strokeWidth="2" />
      </svg>
      <span className="absolute left-1/2 top-[48%] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-rose text-white shadow-lg transition duration-500 [transition-timing-function:var(--ease-out-soft)] group-hover:-translate-y-[85%] group-hover:rotate-12 group-hover:scale-110">
        <HeartIcon size={24} />
      </span>
      <p className="mt-3 text-center font-script text-2xl text-rose-deep">For Samantha</p>
    </div>
  );
}
