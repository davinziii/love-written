import type { ReactNode } from "react";
import { ScaledViewport } from "./ScaledViewport";

/** Typical phone screen width in CSS px — the preview is laid out at this width. */
export const PHONE_WIDTH = 375;

/**
 * A phone-shaped preview. The surprise is laid out at a real phone width and scaled to
 * the frame, so small frames show a true miniature instead of oversized text.
 * ScaledViewport sets `--lw-screen-h` and marks the scroll root (`data-lw-scroll`).
 */
export function PhoneFrame({
  children,
  height = 640,
  watermark = false,
  interactive = true,
  className = "",
  label = "Preview",
}: {
  children: ReactNode;
  height?: number;
  watermark?: boolean;
  interactive?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`relative mx-auto w-full max-w-[390px] rounded-[2.6rem] bg-ink p-2.5 shadow-[0_40px_80px_-30px_rgba(43,29,34,0.55)] ${className}`}
    >
      <div className="relative overflow-hidden rounded-[2.1rem] bg-paper">
        <ScaledViewport virtualWidth={PHONE_WIDTH} height={height} initialScale={0.9} label={label} interactive={interactive} hideScrollbar>
          {children}
        </ScaledViewport>
        {watermark && <Watermark />}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-2 h-5 w-24 -translate-x-1/2 rounded-full bg-ink" />
      </div>
    </div>
  );
}

/**
 * Pre-payment watermark: visible enough to discourage screenshots, light enough to
 * judge the design. It is not in the published page at all — not just hidden.
 */
export function Watermark() {
  const rows = Array.from({ length: 9 });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">
      <div className="absolute -inset-1/2 flex rotate-[-24deg] flex-col justify-center gap-16">
        {rows.map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap font-display text-xl tracking-[0.35em] text-ink/[0.13]"
            style={{ marginLeft: i % 2 ? "-6rem" : "0" }}
          >
            PREVIEW · LOVE, WRITTEN · PREVIEW · LOVE, WRITTEN · PREVIEW · LOVE, WRITTEN
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-4 pb-4 pt-10 text-center text-xs font-medium tracking-wide text-white">
        Preview — the watermark disappears after payment
      </div>
    </div>
  );
}
