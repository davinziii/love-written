"use client";

import { useState } from "react";
import type { ActivityDay } from "@/lib/admin/queries";

const SERIES = [
  { key: "created", label: "Created", color: "var(--color-chart-a)" },
  { key: "published", label: "Went live", color: "var(--color-chart-b)" },
] as const;

const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-PH", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * Surprise activity — created vs. went live, per day. One axis, two series in fixed
 * colors (validated for color-vision deficiency), legend + per-day tooltip + table view.
 */
export function ActivityChart({ data }: { data: ActivityDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.published]));
  const niceMax = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const ticks = [niceMax, Math.round(niceMax / 2), 0];
  const totals = { created: data.reduce((s, d) => s + d.created, 0), published: data.reduce((s, d) => s + d.published, 0) };
  const empty = totals.created === 0 && totals.published === 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-4 text-sm" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              <span className="text-ink-soft">{s.label}</span>
              <span className="font-semibold tabular-nums">{totals[s.key]}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="rounded-full bg-white px-3 py-1 text-xs text-ink-soft ring-1 ring-black/[0.06] hover:text-ink"
          aria-pressed={showTable}
        >
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-72 overflow-y-auto rounded-2xl bg-white">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs text-ink-soft">
              <tr>
                <th className="px-4 py-2 font-medium">Day</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Went live</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.day} className="border-t border-black/[0.04]">
                  <td className="px-4 py-2">{dayLabel(d.day, { month: "short", day: "numeric" })}</td>
                  <td className="px-4 py-2 tabular-nums">{d.created}</td>
                  <td className="px-4 py-2 tabular-nums">{d.published}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          {empty && (
            <p className="absolute inset-x-0 top-1/3 z-10 text-center text-sm text-ink-soft">
              No surprises created or published in the last {data.length} days yet.
            </p>
          )}
          <div className="grid grid-cols-[2rem_1fr] gap-2">
            {/* y-axis */}
            <div className="relative h-52 text-right text-[11px] text-ink-soft tabular-nums" aria-hidden>
              {ticks.map((t, i) => (
                <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="relative h-52">
              {/* recessive gridlines */}
              {ticks.map((_, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="absolute inset-x-0 border-t border-dashed border-black/[0.07]"
                  style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
                />
              ))}
              <div className="relative flex h-full items-end gap-[2px] sm:gap-1" role="img" aria-label={`Created ${totals.created}, went live ${totals.published} in the last ${data.length} days`}>
                {data.map((d, i) => (
                  <div
                    key={d.day}
                    className="relative flex h-full flex-1 cursor-default items-end justify-center gap-[2px] rounded-lg transition-colors hover:bg-black/[0.03]"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`${dayLabel(d.day, { month: "long", day: "numeric" })}: ${d.created} created, ${d.published} went live`}
                  >
                    {SERIES.map((s) => (
                      <span
                        key={s.key}
                        className="w-full max-w-3.5 rounded-t-[4px] transition-[height] duration-500"
                        style={{ height: `${(d[s.key] / niceMax) * 100}%`, minHeight: d[s.key] ? 3 : 0, background: s.color }}
                      />
                    ))}
                    {hover === i && (
                      <div
                        className={`pointer-events-none absolute bottom-full z-20 mb-2 w-36 rounded-xl bg-ink px-3 py-2 text-xs text-cream shadow-lg ${
                          i < 2 ? "left-0" : i > data.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
                        }`}
                      >
                        <p className="font-medium">{dayLabel(d.day, { weekday: "short", month: "short", day: "numeric" })}</p>
                        {SERIES.map((s) => (
                          <p key={s.key} className="mt-1 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                              {s.label}
                            </span>
                            <span className="tabular-nums">{d[s.key]}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* x-axis */}
          <div className="ml-10 mt-2 flex text-[11px] text-ink-soft" aria-hidden>
            {data.map((d, i) => (
              <span key={d.day} className="flex-1 text-center">
                {i % 3 === 0 || i === data.length - 1 ? dayLabel(d.day, { month: "short", day: "numeric" }) : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
