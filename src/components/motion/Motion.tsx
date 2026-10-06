"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from "react";
import { HeartIcon } from "@/components/ui/icons";

/**
 * Lightweight motion helpers. One IntersectionObserver per element, CSS does the
 * animating (see globals.css), and everything is disabled by prefers-reduced-motion.
 */

/** Fades/slides children in once they scroll into view. `delay` staggers siblings. */
export function Reveal({
  children,
  as: Tag = "div",
  delay = 0,
  className = "",
  style,
}: {
  children: ReactNode;
  as?: ElementType;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`lw-reveal ${className}`}
      data-visible={visible}
      style={{ ...style, "--d": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

/**
 * Pauses every CSS animation inside while the region is off-screen, so decorative
 * motion costs nothing when nobody can see it.
 */
export function PauseOffscreen({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOffscreen(!entry?.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} data-offscreen={offscreen}>
      {children}
    </div>
  );
}

/* ─── Heart burst ──────────────────────────────────────────────────────────── */

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
}

let particleId = 0;

/** Small heart burst at a point. Returns a trigger and the particles to render. */
export function useHeartBurst(count = 8) {
  const [particles, setParticles] = useState<Particle[]>([]);

  function burst(x: number, y: number) {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const created = Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = 34 + Math.random() * 30;
      return {
        id: ++particleId,
        x,
        y,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 12,
        size: 9 + Math.round(Math.random() * 8),
      };
    });
    setParticles((p) => [...p, ...created]);
    const ids = new Set(created.map((c) => c.id));
    setTimeout(() => setParticles((p) => p.filter((q) => !ids.has(q.id))), 800);
  }

  const node = (
    <>
      {particles.map((p) => (
        <span
          key={p.id}
          aria-hidden
          className="lw-burst"
          style={{ left: p.x, top: p.y, "--dx": `${p.dx}px`, "--dy": `${p.dy}px` } as CSSProperties}
        >
          <HeartIcon size={p.size} />
        </span>
      ))}
    </>
  );

  return { burst, node };
}

/** Wrap an important emotional CTA: clicking it releases a few hearts. */
export function HeartBurst({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { burst, node } = useHeartBurst();
  return (
    <span
      className={`inline-flex ${className}`}
      onClickCapture={(e: MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        burst(e.clientX || rect.left + rect.width / 2, e.clientY || rect.top + rect.height / 2);
      }}
    >
      {children}
      {node}
    </span>
  );
}

/** One-time celebration (e.g. after publishing). Purely decorative. */
export function Celebrate() {
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-50 h-0">
      {pieces.map((i) => (
        <span
          key={i}
          className="lw-float absolute bottom-0 text-rose"
          style={
            {
              left: `${(i * 53) % 100}%`,
              "--t": `${2.6 + (i % 5) * 0.35}s`,
              "--d": `${(i % 6) * 0.12}s`,
              "--x": `${((i % 3) - 1) * 40}px`,
              "--o": 0.9,
              animationIterationCount: 1,
            } as CSSProperties
          }
        >
          <HeartIcon size={12 + ((i * 7) % 16)} />
        </span>
      ))}
    </div>
  );
}
