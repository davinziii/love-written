import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/ui/Brand";
import { isManualPayments } from "@/lib/payments/mode";

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
  {
    q: "What if I pay but never publish my surprise?",
    a: "Paid surprises that are never published are deleted after 60 days without being opened. Each time you open your private link, the 60 days start again — so just open it now and then until you're ready to publish.",
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
  { q: "Can I upload my own fonts?", a: "No. Each template offers a curated set of fonts that look great together." },
  {
    q: "Is my surprise searchable on Google?",
    a: "No. Surprise pages are marked so search engines don't index or archive them, and each lives at a long, unguessable link. Anyone who has the link can open it, so share it only with the person it's for.",
  },
  {
    q: "Are my photos private?",
    a: "Photos are stored in private storage and are only shown through short-lived secure links when someone opens the surprise. We also remove location data from photos.",
  },
  { q: "Are payments refundable?", a: "Successful payments are non-refundable. If anything on our side stops your surprise from publishing, we fix it for free — you'll never pay twice." },
  {
    q: "How can I pay?",
    a: isManualPayments
      ? "For now, send us a message and pay with GCash, Maya or bank transfer. We confirm your payment personally and send you your private link."
      : "Through PayMongo — GCash, Maya, QR Ph, or card, depending on availability.",
  },
  {
    q: "Can I share it without showing the link?",
    a: "Yes. Once your surprise is scheduled or live, you'll get a heart-shaped QR code. Send the heart instead of the link — scanning it with a phone camera opens the surprise.",
  },
  {
    q: "Someone sent me something hurtful. What can I do?",
    a: (
      <>
        Tap <strong>Report a concern</strong> at the very bottom of the surprise. Reports are anonymous, and we take down
        surprises that break our <Link href="/terms#acceptable-use" className="text-rose underline underline-offset-4">rules</Link>.
      </>
    ),
  },
  {
    q: "Where's your privacy policy and terms?",
    a: (
      <>
        Read our <Link href="/privacy" className="text-rose underline underline-offset-4">Privacy Notice</Link> and{" "}
        <Link href="/terms" className="text-rose underline underline-offset-4">Terms of Service</Link>.
      </>
    ),
  },
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
