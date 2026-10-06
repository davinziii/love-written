"use client";

import Link from "next/link";
import { latestLocalDraft } from "@/lib/client/drafts";
import { useHydrated } from "@/lib/client/useHydrated";
import { getTemplate } from "@/templates";

/** "Welcome back ❤️ — we found your surprise on this device." */
export function ResumeDraftBanner({ templateId }: { templateId?: string }) {
  const hydrated = useHydrated();
  const draft = hydrated ? latestLocalDraft(templateId) : undefined;
  if (!draft) return null;

  return (
    <div className="mx-auto mb-8 flex max-w-3xl flex-col items-center gap-3 rounded-3xl bg-petal px-6 py-5 text-center ring-1 ring-blush sm:flex-row sm:justify-between sm:text-left">
      <div>
        <p className="font-display text-lg">Welcome back ❤️</p>
        <p className="text-sm text-ink-soft">
          We found your {getTemplate(draft.templateId)?.name ?? "surprise"} on this device.
        </p>
      </div>
      <Link
        href={`/studio/${draft.surpriseId}`}
        className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
      >
        Continue editing
      </Link>
    </div>
  );
}
