import type { CSSProperties } from "react";
import { HeartIcon, Icon } from "@/components/ui/icons";

/**
 * Decorative, server-rendered motion layers. Pure CSS animation (see globals.css):
 * a few blurred blobs and a handful of hearts — never hundreds of particles.
 * All aria-hidden; all disabled under prefers-reduced-motion.
 */

export function GradientBlobs({ variant = "hero" }: { variant?: "hero" | "soft" }) {
  const blobs =
    variant === "hero"
      ? [
          { c: "#f6c3cf", s: "42rem", top: "-12rem", left: "55%", t: "28s" },
          { c: "#fde4d0", s: "34rem", top: "14rem", left: "-10rem", t: "34s" },
          { c: "#e9dcf7", s: "26rem", top: "26rem", left: "70%", t: "30s" },
        ]
      : [
          { c: "#f6d5dc", s: "30rem", top: "-8rem", left: "-6rem", t: "32s" },
          { c: "#fbe3d3", s: "26rem", top: "40%", left: "70%", t: "36s" },
        ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {blobs.map((b, i) => (
        <span
          key={i}
          className="lw-blob absolute rounded-full opacity-70 blur-3xl"
          style={{ background: b.c, width: b.s, height: b.s, top: b.top, left: b.left, "--t": b.t } as CSSProperties}
        />
      ))}
    </div>
  );
}

const HEARTS = [
  { left: "6%", size: 14, t: "16s", d: "-2s", x: "20px", o: 0.45 },
  { left: "18%", size: 10, t: "19s", d: "-9s", x: "-14px", o: 0.35 },
  { left: "34%", size: 12, t: "22s", d: "-5s", x: "10px", o: 0.3 },
  { left: "52%", size: 9, t: "18s", d: "-13s", x: "-8px", o: 0.35 },
  { left: "68%", size: 16, t: "21s", d: "-3s", x: "16px", o: 0.4 },
  { left: "83%", size: 11, t: "17s", d: "-11s", x: "-18px", o: 0.4 },
  { left: "93%", size: 13, t: "24s", d: "-7s", x: "6px", o: 0.3 },
];

/** Seven hearts drifting upward, slowly. */
export function FloatingHearts({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {HEARTS.map((h, i) => (
        <span
          key={i}
          className="lw-float absolute -bottom-6 text-rose"
          style={{ left: h.left, "--t": h.t, "--d": h.d, "--x": h.x, "--o": h.o } as CSSProperties}
        >
          <HeartIcon size={h.size} />
        </span>
      ))}
    </div>
  );
}

/** A few twinkling sparkles placed by the caller. */
export function Sparkle({ style, size = 18, delay = "0s" }: { style: CSSProperties; size?: number; delay?: string }) {
  return (
    <span aria-hidden className="lw-twinkle pointer-events-none absolute text-[#e8a33d]" style={{ ...style, "--d": delay } as CSSProperties}>
      <Icon.sparkle size={size} />
    </span>
  );
}

/** Headline that rises in word by word. Screen readers get the plain sentence. */
export function AnimatedHeadline({ text, highlight, className = "" }: { text: string; highlight?: string; className?: string }) {
  const words = text.split(" ");
  const highlightWords = new Set((highlight ?? "").split(" ").filter(Boolean));
  return (
    <h1 className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden>
          <span
            className={`lw-word ${highlightWords.has(w.replace(/[.,!]/g, "")) ? "relative text-rose" : ""}`}
            style={{ "--i": i } as CSSProperties}
          >
            {w}
            {highlightWords.has(w.replace(/[.,!]/g, "")) && w === words.findLast((x) => highlightWords.has(x.replace(/[.,!]/g, ""))) && (
              <svg
                className="lw-draw absolute -bottom-2 left-0 h-3 w-full text-rose/70"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                style={{ "--d": `${words.length * 90 + 500}ms` } as CSSProperties}
              >
                <path d="M2 9C40 3 120 1 198 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" pathLength={1} />
              </svg>
            )}
          </span>{" "}
        </span>
      ))}
    </h1>
  );
}

/** A short handwritten line that types itself out, with a blinking caret. */
export function TypedLine({ text, delay = "1.4s" }: { text: string; delay?: string }) {
  return (
    <p className="font-script text-2xl text-rose-deep sm:text-3xl">
      <span className="sr-only">{text}</span>
      <span aria-hidden className="lw-typing" style={{ "--steps": text.length, "--d": delay } as CSSProperties}>
        {text}
      </span>
      <span aria-hidden className="lw-caret" />
    </p>
  );
}

/** Section eyebrow label with an icon. */
export function Eyebrow({ children, icon: Glyph = Icon.sparkle }: { children: React.ReactNode; icon?: (p: { size?: number }) => React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-rose shadow-sm ring-1 ring-blush backdrop-blur">
      <Glyph size={14} />
      {children}
    </p>
  );
}
