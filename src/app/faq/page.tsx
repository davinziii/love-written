import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/ui/Brand";

export const metadata: Metadata = { title: "FAQ" };

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "How long does my surprise stay online?",
    a: "30 days after it goes live. If you schedule it, the 30 days start at the reveal time — not when you create or pay for it.",
  },
  {
    q: "Can I edit after publishing?",
    a: "No. You can edit as much as you like before it goes live (including while it's scheduled). Once it's live, its content, photos, theme and music are locked.",
  },
  {
    q: "What happens after 30 days?",
    a: "The surprise expires and its photos, messages and other personal content are deleted. We verify the deletion actually happened. Please save anything you'd like to keep before then.",
  },
  { q: "Do I need an account?", a: "No. Your surprise is remembered on your device, and you get a recovery code to find it anywhere else." },
  {
    q: "What if I lose my surprise?",
    a: (
      <>
        Use your recovery code on the <Link href="/recover" className="text-rose underline underline-offset-4">Find My Surprise</Link> page.
      </>
    ),
  },
  {
    q: "What if my payment succeeded but publishing failed?",
    a: "Do not pay again. Your payment is recorded separately from publishing. You can try again right away, or report the problem and you'll get a report ID we use to fix it — without charging you again.",
  },
  {
    q: "Can I upload my own music?",
    a: "No. To keep things simple and properly licensed, music (when available for a template) comes only from Love, Written's own library.",
  },
  { q: "Can I upload my own fonts?", a: "No. Each template offers a curated set of type styles that look great together." },
  {
    q: "Is my surprise searchable on Google?",
    a: "No. Surprise pages are marked so search engines don't index or archive them, and each lives at a long, unguessable link. Anyone who has the link can open it, so share it only with the person it's for.",
  },
  {
    q: "Are my photos private?",
    a: "Photos are stored in private storage and are only shown through short-lived secure links when someone opens the surprise. We also remove location data from photos.",
  },
  { q: "Are payments refundable?", a: "Successful payments are non-refundable under our initial policy." },
  { q: "How can I pay?", a: "Through PayMongo — GCash, Maya, QR Ph, or card, depending on availability." },
];

export default function FaqPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-5xl tracking-tight">Questions, answered</h1>
        <div className="mt-10 divide-y divide-line rounded-[2rem] bg-paper ring-1 ring-line">
          {FAQS.map((f) => (
            <details key={f.q} className="group px-6 py-5 sm:px-8">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {f.q}
                <span className="text-rose transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
