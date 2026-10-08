/* eslint-disable @next/next/no-img-element -- small static illustrations */

import type { CSSProperties } from "react";
import { HeartIcon, Icon } from "@/components/ui/icons";
import { DEFAULT_FRAME_ID, getFrame } from "@/photobooth/frames";
import s from "./photobooth.module.css";

/**
 * "Two people → four photos → one strip", drawn with sample illustrations and the real
 * frame preview. No camera, no client JS — pure CSS motion (off for reduced motion).
 */
export function PhotoboothVisual({ className = "" }: { className?: string }) {
  const frame = getFrame(DEFAULT_FRAME_ID)!;
  return (
    <div className={`relative mx-auto flex max-w-md items-center justify-center gap-4 sm:gap-6 ${className}`} aria-hidden>
      <div className="flex flex-col items-center gap-5">
        <Polaroid src="/samples/memory-1.svg" label="You" className={s.floatA} r="-4deg" />
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-rose shadow-sm ring-1 ring-blush">
          <HeartIcon size={16} />
        </span>
        <Polaroid src="/samples/letter-2.svg" label="Your person" className={s.floatB} r="3deg" />
      </div>
      <Icon.arrowRight size={22} className="shrink-0 text-rose/70" />
      <img
        src={frame.preview}
        alt=""
        width={400}
        height={1200}
        className={`h-[22rem] w-auto rounded-sm shadow-[0_30px_50px_-20px_rgba(0,0,0,0.55)] sm:h-[26rem] ${s.stripIn}`}
        loading="lazy"
      />
    </div>
  );
}

function Polaroid({ src, label, className = "", r }: { src: string; label: string; className?: string; r: string }) {
  return (
    <figure className={`m-0 w-28 bg-white p-1.5 pb-6 shadow-lg sm:w-32 ${className}`} style={{ rotate: r, "--r": "0deg" } as CSSProperties}>
      <img src={src} alt="" className="aspect-[3/4] w-full object-cover" loading="lazy" />
      <figcaption className="mt-1 text-center font-display text-sm text-ink-soft">{label}</figcaption>
    </figure>
  );
}
