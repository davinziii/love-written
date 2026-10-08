import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/ui/Brand";
import { HeartIcon, Icon } from "@/components/ui/icons";
import { Eyebrow, GradientBlobs } from "@/components/landing/Decor";
import { Reveal } from "@/components/motion/Motion";
import { MessageToOrderCTA } from "@/components/landing/OrderCTA";
import { PhotoboothVisual } from "@/components/photobooth/PhotoboothVisual";
import { CreateBoothButton } from "@/components/photobooth/CreateBoothButton";
import { isManualPayments } from "@/lib/payments/mode";
import { formatPeso } from "@/lib/format";
import { photoboothPriceCentavos } from "@/lib/photobooth/price";
import { PHOTOBOOTH_RETENTION_DAYS } from "@/lib/photobooth/constants";

export const metadata: Metadata = {
  title: "Photobooth",
  description: "A private digital photobooth for two. Take four photos together, even when you're apart.",
};

const STEPS = [
  { icon: Icon.wallet, title: "Pay", body: "One session for two people." },
  { icon: Icon.send, title: "Invite your person", body: "They get their own private link — and join free." },
  { icon: Icon.monitor, title: "Open your cameras", body: "On your phones or laptops, wherever you both are." },
  { icon: Icon.clock, title: "Take 4 photos together", body: "A shared 3 · 2 · 1 countdown, so you click at the same moment." },
  { icon: Icon.check, title: "Approve your favorites", body: "See each other live, chat, and keep each photo together — or retake it." },
  { icon: Icon.image, title: "Pick your look & download", body: "Black & white or color, black or white frame — then your strip and all four photos." },
];

export default function PhotoboothPage() {
  const price = formatPeso(photoboothPriceCentavos());
  const cta = isManualPayments ? <MessageToOrderCTA templateName="Photobooth" /> : <CreateBoothButton label={`Create a Photobooth — ${price}`} />;

  return (
    <>
      <SiteHeader />
      <main className="overflow-x-clip">
        <section className="relative isolate">
          <GradientBlobs variant="soft" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <Reveal>
              <Eyebrow icon={(p) => <HeartIcon {...p} />}>Love, Written Photobooth</Eyebrow>
              <h1 className="mt-5 font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">Your own little photobooth, wherever you are.</h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
                Invite someone you love. Open your cameras. Take four photos together. Keep the moment.
              </p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-5xl">{price}</span>
                <span className="text-ink-soft">/ session · your person joins free</span>
              </p>
              <div className="mt-7">{cta}</div>
            </Reveal>
            <Reveal delay={120}>
              <PhotoboothVisual />
            </Reveal>
          </div>
        </section>

        <section className="bg-paper py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <Eyebrow icon={Icon.book}>How it works</Eyebrow>
              <h2 className="mt-5 font-display text-4xl tracking-tight sm:text-5xl">Two people, one camera moment</h2>
            </Reveal>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal as="li" key={step.title} delay={i * 70}>
                  <div className="lw-lift h-full rounded-[1.75rem] bg-cream p-6 ring-1 ring-line">
                    <div className="flex items-center justify-between">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-rose shadow-sm ring-1 ring-blush">
                        <step.icon size={20} />
                      </span>
                      <span className="font-display text-3xl text-blush">{i + 1}</span>
                    </div>
                    <h3 className="mt-4 font-display text-xl">{i === 0 ? `Pay ${price}` : step.title}</h3>
                    <p className="mt-1.5 leading-relaxed text-ink-soft">{step.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
          <Reveal>
            <div className="rounded-[2rem] bg-ink p-8 text-cream sm:p-10">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blush">
                <Icon.clock size={14} /> Please read
              </p>
              <h2 className="mt-4 font-display text-3xl sm:text-4xl">Your photos are temporary.</h2>
              <p className="mt-4 text-lg leading-relaxed text-cream/80">
                After your photobooth session is completed, your photos will be available for download for{" "}
                <strong className="text-cream">{PHOTOBOOTH_RETENTION_DAYS} days</strong>. After {PHOTOBOOTH_RETENTION_DAYS} days, the photos and
                session data will be <strong className="text-cream">permanently deleted</strong>.
              </p>
              <ul className="mt-6 grid gap-3 text-sm text-cream/75 sm:grid-cols-2">
                {[
                  "The 7 days start only when your four photos are done — not when you pay.",
                  "Your camera stays on your device. Only the photos you keep together are saved.",
                  "Each of you gets your own private link. Nobody else can join.",
                  "Camera trouble? Your paid session is never lost — come back anytime.",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <Icon.check size={16} className="mt-0.5 shrink-0 text-blush" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal className="mt-12 text-center">
            <p className="font-display text-3xl">Take a photo together, even when you&rsquo;re apart.</p>
            <div className="mt-6 flex justify-center">{cta}</div>
          </Reveal>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
