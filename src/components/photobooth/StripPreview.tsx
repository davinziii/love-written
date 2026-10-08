"use client";

/* eslint-disable @next/next/no-img-element -- private signed photo URLs + static frame art */

import { stableUrl } from "@/lib/photobooth/stable-url";
import type { BoothState, StripFilter } from "@/lib/photobooth/types";
import type { PhotoboothFrame } from "@/photobooth/frames";
import { HeartIcon } from "@/components/ui/icons";

/**
 * A live preview of the final strip, drawn from the SAME frame config the server uses — so
 * what they see here is what they'll download. Photos appear in their slots as soon as both
 * people keep them; empty slots wait with a little heart.
 */
export function StripPreview({
  frame,
  approved,
  filter,
  className = "",
}: {
  frame: PhotoboothFrame;
  approved: BoothState["approved"];
  filter: StripFilter;
  className?: string;
}) {
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[3px] shadow-[0_18px_36px_-16px_rgba(0,0,0,0.55)] ${className}`}
      style={{ aspectRatio: `${frame.width} / ${frame.height}`, background: frame.background }}
      aria-label="Preview of your photobooth strip"
      role="img"
    >
      {frame.slots.map((slot, i) => {
        const shot = approved.find((a) => a.round === i + 1);
        const leftW = Math.floor((slot.width - frame.gutter) / 2);
        const halves = [
          { x: slot.x, w: leftW, photo: shot?.a },
          { x: slot.x + leftW + frame.gutter, w: slot.width - frame.gutter - leftW, photo: shot?.b },
        ];
        return halves.map((h, j) => (
          <div
            key={`${i}-${j}`}
            className="absolute overflow-hidden"
            style={{ left: pct(h.x, frame.width), top: pct(slot.y, frame.height), width: pct(h.w, frame.width), height: pct(slot.height, frame.height) }}
          >
            {h.photo ? (
              <img
                src={stableUrl(h.photo)}
                alt=""
                className={`h-full w-full object-cover transition duration-500 ${filter === "bw" ? "grayscale" : ""}`}
              />
            ) : (
              <div className="grid h-full w-full place-items-center bg-white/[0.06]">
                <HeartIcon size={10} className="text-rose/40" />
              </div>
            )}
          </div>
        ));
      })}
      {frame.overlay && <img src={frame.overlay} alt="" className="pointer-events-none absolute inset-0 h-full w-full" />}
    </div>
  );
}
