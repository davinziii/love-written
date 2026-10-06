"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { Watermark } from "./PhoneFrame";
import { ScaledViewport } from "./ScaledViewport";

/**
 * Default laptop width the desktop preview is laid out at. Wide enough for the renderer's
 * wide-screen layout (≥760px), small enough that text stays readable once scaled down.
 */
export const DESKTOP_WIDTH = 900;

/**
 * A desktop browser window showing the surprise as it appears on a laptop/desktop.
 * The content is laid out at a real laptop width and scaled down evenly — it is not a
 * squashed phone layout, and text keeps its true proportions.
 */
export function BrowserFrame({
  children,
  height = 560,
  watermark = false,
  interactive = true,
  label = "Desktop preview",
  className = "",
  virtualWidth = DESKTOP_WIDTH,
}: {
  children: ReactNode;
  height?: number;
  watermark?: boolean;
  interactive?: boolean;
  label?: string;
  className?: string;
  /** Lay out at a narrower laptop width for small frames, so text stays legible. */
  virtualWidth?: number;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[1.25rem] bg-white shadow-[0_40px_80px_-36px_rgba(43,29,34,0.5)] ring-1 ring-ink/10 ${className}`}
    >
      <div className="flex h-10 items-center gap-3 border-b border-ink/5 bg-[#f6f1ef] px-4" aria-hidden>
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ee6a5f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f5bd4f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#61c454]" />
        </span>
        <span className="mx-auto flex min-w-0 max-w-sm flex-1 items-center justify-center gap-1.5 truncate rounded-full bg-white px-3 py-1 text-[11px] text-ink-soft ring-1 ring-ink/5">
          <Icon.lock size={11} />
          lovewritten.com/s/<span className="tracking-widest">••••••••</span>
        </span>
        <span className="w-12" />
      </div>
      <div className="relative bg-paper">
        <ScaledViewport virtualWidth={virtualWidth} height={height} initialScale={0.6} label={label} interactive={interactive}>
          {children}
        </ScaledViewport>
        {watermark && <Watermark />}
      </div>
    </div>
  );
}
