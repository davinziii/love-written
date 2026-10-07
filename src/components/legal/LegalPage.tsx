import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/components/ui/Brand";

export const CONTACT_EMAIL = "lovewritten.business@gmail.com";
export const LEGAL_UPDATED = "October 7, 2026";

/** Shared layout for the Privacy Notice and Terms pages. */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: ReactNode;
  sections: { id: string; title: string; body: ReactNode }[];
}) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <header className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose">Legal</p>
          <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-ink-soft">Last updated {LEGAL_UPDATED}</p>
          <div className="mt-6 text-lg leading-relaxed text-ink-soft">{intro}</div>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[14rem_1fr]">
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <ol className="space-y-1.5 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-ink-soft transition hover:text-rose">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="max-w-3xl space-y-10">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="font-display text-2xl">
                  {i + 1}. {s.title}
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-ink-soft [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink [&_ul]:space-y-1.5">
                  {s.body}
                </div>
              </section>
            ))}
            <p className="rounded-2xl bg-paper p-5 text-sm text-ink-soft ring-1 ring-line">
              Questions? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-rose underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
              . See also our <Link href="/faq" className="text-rose underline underline-offset-2">FAQ</Link>.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
