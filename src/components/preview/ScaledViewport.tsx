"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Renders content at a real device width (e.g. 375px for a phone, ~1000px for a laptop)
 * and scales it to fit the frame with a GPU transform — like a live screenshot.
 * Text, photos and spacing therefore keep the exact proportions the recipient will see,
 * instead of reflowing to the frame's (much smaller) width.
 */
export function ScaledViewport({
  virtualWidth,
  height,
  initialScale,
  label,
  interactive = true,
  hideScrollbar = false,
  children,
}: {
  /** The device width the content is laid out at, in CSS px. */
  virtualWidth: number;
  /** The frame's visible height, in px. */
  height: number;
  /** Best guess before the frame is measured (avoids a jump on first paint). */
  initialScale: number;
  label: string;
  interactive?: boolean;
  hideScrollbar?: boolean;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setFrameWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Never enlarge: if the frame is wider than the device, just use the frame's width.
  // A hidden frame (display: none) measures 0 wide — keep the initial guess instead.
  const measured = frameWidth !== null && frameWidth > 0 ? frameWidth : null;
  const scale = measured === null ? initialScale : Math.min(1, measured / virtualWidth);
  const width = measured !== null && scale === 1 ? measured : virtualWidth;
  const innerHeight = Math.round(height / scale);

  return (
    <div ref={outer} className="relative overflow-hidden" style={{ height }}>
      <div
        data-lw-scroll
        role="region"
        aria-label={label}
        tabIndex={interactive ? 0 : -1}
        className={`absolute left-0 top-0 origin-top-left overflow-y-auto overscroll-contain ${
          hideScrollbar ? "[scrollbar-width:none]" : "[scrollbar-width:thin]"
        } ${interactive ? "" : "pointer-events-none select-none"}`}
        style={
          {
            width,
            height: innerHeight,
            transform: scale === 1 ? undefined : `scale(${scale})`,
            "--lw-screen-h": `${innerHeight}px`,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}
