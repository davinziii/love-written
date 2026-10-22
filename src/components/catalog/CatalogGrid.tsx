"use client";

/* eslint-disable @next/next/no-img-element -- small static covers, already sized and compressed */

import Link from "next/link";
import { useState } from "react";
import { Price } from "@/components/ui/Price";
import { Icon } from "@/components/ui/icons";
import { COLLECTIONS, type TemplateCollection } from "@/templates/types";

export type CatalogItem = {
  id: string;
  name: string;
  collection: TemplateCollection;
  priceCentavos: number;
  /** e.g. "8–30" or "5" */
  photos: string;
};

const BADGE: Record<TemplateCollection, (p: { size?: number }) => React.ReactNode> = {
  letters: (p) => <Icon.envelope {...p} />,
  photos: (p) => <Icon.image {...p} />,
  games: (p) => <Icon.sparkle {...p} />,
};

/**
 * The catalog: filter chips and compact cards with a still cover (no live previews and no
 * animation, so the page is light and calm). The whole card is one link to the template page.
 */
export function CatalogGrid({ items, comingSoon }: { items: CatalogItem[]; comingSoon: readonly string[] }) {
  const [filter, setFilter] = useState<TemplateCollection | "all">("all");
  const shown = filter === "all" ? items : items.filter((t) => t.collection === filter);
  const chips = [{ id: "all" as const, label: "All" }, ...COLLECTIONS.filter((c) => items.some((t) => t.collection === c.id))];

  return (
    <>
      <div role="tablist" aria-label="Filter surprises" className="mt-10 flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={`rounded-full px-3 py-2 text-[13px] font-semibold sm:px-5 sm:text-sm ${
              filter === c.id ? "bg-ink text-cream" : "bg-white text-ink-soft ring-1 ring-line hover:text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((t) => {
          const Badge = BADGE[t.collection];
          return (
            <li key={t.id}>
              <article className="relative flex h-full flex-col rounded-[1.25rem] bg-white p-2 ring-1 ring-line hover:ring-rose/50 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-rose sm:p-2.5">
                <div className="relative">
                  <img
                    src={`/templates/${t.id}.webp`}
                    alt=""
                    width={480}
                    height={600}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full rounded-[0.9rem] bg-blush/40 object-cover object-[50%_40%]"
                  />
                  <span
                    className="absolute -bottom-4 right-3 grid h-9 w-9 place-items-center rounded-full bg-petal text-rose ring-[3px] ring-white sm:h-10 sm:w-10"
                    aria-hidden
                  >
                    <Badge size={16} />
                  </span>
                </div>
                <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-3 sm:px-2">
                  <p className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                    {COLLECTIONS.find((c) => c.id === t.collection)?.label}
                    <span className="h-1.5 w-1.5 rounded-full bg-rose" aria-hidden />
                  </p>
                  <h2 className="mt-1 text-[15px] font-semibold leading-tight sm:text-base">
                    {/* The ::after overlay makes the whole card one link. */}
                    <Link
                      href={`/surprises/${t.id}`}
                      className="after:absolute after:inset-0 after:rounded-[1.25rem] after:content-[''] focus-visible:outline-none"
                    >
                      {t.name}
                    </Link>
                  </h2>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-ink-soft">
                    <div>
                      <dt>Price</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-ink">
                        <Price centavos={t.priceCentavos} />
                      </dd>
                    </div>
                    <div>
                      <dt>Photos</dt>
                      <dd className="mt-0.5 text-sm font-semibold text-ink">{t.photos}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            </li>
          );
        })}
        {filter === "all" && (
          <li>
            <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-[1.25rem] border-2 border-dashed border-line bg-white/50 p-5 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-petal text-rose">
                <Icon.sparkle size={18} />
              </span>
              <p className="mt-3 font-display text-lg">More surprises soon</p>
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                {comingSoon.map((c) => (
                  <li key={c} className="rounded-full bg-white px-2.5 py-1 text-[11px] text-ink-soft ring-1 ring-line">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        )}
      </ul>
    </>
  );
}
