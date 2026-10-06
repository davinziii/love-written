"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icons";
import { PhoneFrame, Watermark } from "./PhoneFrame";
import { BrowserFrame } from "./BrowserFrame";

export type Device = "desktop" | "mobile";

/**
 * Desktop / Mobile / Full preview of a surprise. `render` is called for whichever view
 * is active, so each view gets its own layout (container queries in the renderer pick
 * the wide or the phone layout from the real width).
 */
export function DevicePreview({
  render,
  watermark = false,
  defaultDevice = "desktop",
  phoneHeight = 640,
  desktopHeight = 560,
  label = "Preview",
  compact = false,
}: {
  render: () => ReactNode;
  watermark?: boolean;
  defaultDevice?: Device;
  phoneHeight?: number;
  desktopHeight?: number;
  label?: string;
  compact?: boolean;
}) {
  const [device, setDevice] = useState<Device>(defaultDevice);
  const [full, setFull] = useState(false);

  return (
    <div>
      <div className={`mb-4 flex items-center justify-between gap-3 ${compact ? "" : "sm:mb-5"}`}>
        <div role="tablist" aria-label="Preview size" className="inline-flex rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-line">
          {(
            [
              ["desktop", "Desktop", Icon.monitor],
              ["mobile", "Mobile", Icon.phone],
            ] as const
          ).map(([value, text, Glyph]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={device === value}
              onClick={() => setDevice(value)}
              className={`lw-press inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                device === value ? "bg-ink text-cream shadow" : "text-ink-soft hover:text-ink"
              }`}
            >
              <Glyph size={15} />
              {compact ? <span className="sr-only">{text}</span> : text}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFull(true)}
          className="lw-press inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-2 text-sm font-medium text-ink-soft shadow-sm ring-1 ring-line hover:text-ink"
        >
          <Icon.expand size={15} />
          {compact ? <span className="sr-only">Full preview</span> : "Full preview"}
        </button>
      </div>

      <div key={device} className="animate-fade-up">
        {device === "desktop" ? (
          <BrowserFrame height={desktopHeight} watermark={watermark} label={`${label} — desktop`}>
            {render()}
          </BrowserFrame>
        ) : (
          <PhoneFrame height={phoneHeight} watermark={watermark} label={`${label} — mobile`}>
            {render()}
          </PhoneFrame>
        )}
      </div>

      {full && <FullPreview onClose={() => setFull(false)} watermark={watermark} label={label}>{render()}</FullPreview>}
    </div>
  );
}

/** The surprise at the real size of this screen, exactly like the recipient's view. */
export function FullPreview({
  children,
  onClose,
  watermark,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  watermark: boolean;
  label: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${label} — full screen`} className="fixed inset-0 z-50 bg-paper">
      <div
        data-lw-scroll
        className="h-full overflow-y-auto overscroll-contain"
        style={{ "--lw-screen-h": "100svh" } as CSSProperties}
      >
        {children}
      </div>
      {watermark && <Watermark />}
      <button
        type="button"
        onClick={onClose}
        autoFocus
        className="lw-press fixed right-4 top-4 z-30 inline-flex items-center gap-2 rounded-full bg-ink/85 px-4 py-2.5 text-sm font-medium text-cream shadow-lg backdrop-blur"
      >
        <Icon.close size={16} />
        Close preview
      </button>
    </div>,
    document.body,
  );
}
