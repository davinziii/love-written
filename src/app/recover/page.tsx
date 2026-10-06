import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/ui/Brand";
import { RecoverForm } from "@/components/recover/RecoverForm";

export const metadata: Metadata = {
  title: "Find My Surprise",
  robots: { index: false, follow: false },
};

export default function RecoverPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16 sm:py-24">
        <h1 className="text-center font-display text-4xl tracking-tight">Find My Surprise</h1>
        <p className="mt-3 text-center text-ink-soft">
          Enter the recovery code you got when you started. It works on any device — no account needed.
        </p>
        <div className="mt-10 rounded-[2rem] bg-paper p-7 ring-1 ring-line">
          <RecoverForm />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
