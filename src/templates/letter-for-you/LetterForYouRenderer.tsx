"use client";

/* eslint-disable @next/next/no-img-element -- media is pre-optimized and served via signed URLs */

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { RendererProps } from "../types";
import { getFont, getTheme, themeVars } from "../styles";
import { HeartIcon } from "../shared/icons";
import { BURST, FLOWER_SET } from "./flowers";
import { arrangeDesktop, arrangeStack, BOTTOM_REM, SIZE_FACTOR, styleOf, type Group, type Placement } from "./arrange";
import type { LetterForYouData } from "./definition";
import s from "./letter-for-you.module.css";

/**
 * A Letter for You — trusted renderer.
 *
 * Timeline after the envelope is tapped (all CSS-driven; this component only flips phases):
 *   0ms     flap swings open, wax seal fades, a sheet of paper peeks out
 *   1050ms  phase "open": envelope drops away, the letter rises, flowers burst upward,
 *           the greeting is "written" in ink, the background starts warming, and the
 *           photos around the letter arrive one by one
 *   later   photos further down arrive as they scroll into view; tapping a photo
 *           opens it large
 *
 * It never checks payment, access, editing rights, expiry or storage.
 */

type Phase = "closed" | "opening" | "open";
type Layout = "stack" | "desktop";
type Enter = "enterRise" | "enterTurn" | "enterPop" | "enterSide";

const PHOTO_COUNT = 12;
const REQUIRED_PHOTOS = 10;
/** From this width the photos sit beside the letter (the 900px desktop preview qualifies). */
const DESKTOP_MIN_PX = 880;

const OPEN_AT_MS = 1050;
const BURST_CLEANUP_MS = 4200;
const MAX_TAP_HEARTS = 14;
const FIRST_PHOTO_S = 0.85;
const PHOTO_STEP_S = 0.12;

const BG_HEARTS = [
  { left: "6%", size: 14, t: "17s", d: "0s", x: "18px", o: 0.35 },
  { left: "17%", size: 10, t: "21s", d: "-7s", x: "-12px", o: 0.25 },
  { left: "29%", size: 18, t: "19s", d: "-12s", x: "10px", o: 0.22 },
  { left: "44%", size: 9, t: "16s", d: "-4s", x: "-8px", o: 0.3 },
  { left: "58%", size: 15, t: "22s", d: "-15s", x: "14px", o: 0.25 },
  { left: "71%", size: 11, t: "18s", d: "-9s", x: "-16px", o: 0.3 },
  { left: "83%", size: 17, t: "20s", d: "-2s", x: "8px", o: 0.22 },
  { left: "94%", size: 12, t: "23s", d: "-11s", x: "-6px", o: 0.28 },
];

/** Petals drifting down slowly behind everything. */
const PETALS = [
  { left: "11%", size: 16, t: "19s", d: "-3s", x: "60px", r: "320deg" },
  { left: "36%", size: 12, t: "23s", d: "-14s", x: "-50px", r: "-280deg" },
  { left: "63%", size: 18, t: "21s", d: "-8s", x: "70px", r: "260deg" },
  { left: "88%", size: 13, t: "25s", d: "-18s", x: "-40px", r: "-340deg" },
];

function enterFor(group: Group, pos: number): Enter {
  if (group === "left" || group === "right") return "enterSide";
  const cycle: Enter[] = group === "top" ? ["enterTurn", "enterPop"] : ["enterRise", "enterPop", "enterTurn"];
  return cycle[pos % cycle.length]!;
}

let tapId = 0;

export function LetterForYouRenderer({ data, mode }: RendererProps<LetterForYouData>) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [burst, setBurst] = useState(false);
  const [taps, setTaps] = useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const [layout, setLayout] = useState<Layout>("stack");
  const [letterH, setLetterH] = useState(0);
  const [sideW, setSideW] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const zoomCloseRef = useRef<HTMLButtonElement>(null);
  const zoomOpener = useRef<HTMLElement | null>(null);
  const openedAt = useRef(0);
  const timers = useRef<number[]>([]);
  const postmarkId = `lfy-postmark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const theme = getTheme(data.theme);
  const vars = themeVars(theme, getFont(data.story_font, "garamond"), getFont(data.final_font, "parisienne")) as CSSProperties;

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  // Measure the page width, the room beside the letter and the letter's real height (the
  // scene is laid out, hidden, even before the envelope opens) to arrange the photos.
  useEffect(() => {
    const root = rootRef.current;
    const letter = letterRef.current;
    const side = sideRef.current;
    if (!root || !letter || !side) return;
    const measure = () => {
      setLayout(root.offsetWidth >= DESKTOP_MIN_PX ? "desktop" : "stack");
      setLetterH(letter.offsetHeight);
      setSideW(side.offsetWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(letter);
    ro.observe(side);
    return () => ro.disconnect();
  }, []);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  function open() {
    if (phase !== "closed") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      openedAt.current = performance.now();
      setPhase("open");
      later(() => letterRef.current?.focus({ preventScroll: true }), 50);
      return;
    }
    setPhase("opening");
    later(() => {
      openedAt.current = performance.now();
      setPhase("open");
      setBurst(true);
    }, OPEN_AT_MS);
    later(() => setBurst(false), OPEN_AT_MS + BURST_CLEANUP_MS);
    later(() => letterRef.current?.focus({ preventScroll: true }), OPEN_AT_MS + 900);
  }

  /** Tap the background → a little heart pops up there. Cleaned up after its animation. */
  const onTap = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (phase !== "open" || zoom !== null) return;
      const target = e.target as HTMLElement;
      if (target.closest("a, button, input, textarea, [data-no-hearts]")) return;
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      // Works inside the scaled preview frames too: convert screen px → layout px.
      const scaleX = rect.width / root.offsetWidth || 1;
      const scaleY = rect.height / root.offsetHeight || 1;
      const heart = {
        id: ++tapId,
        x: (e.clientX - rect.left) / scaleX,
        y: (e.clientY - rect.top) / scaleY,
        size: 18 + (tapId % 3) * 6,
      };
      setTaps((list) => [...list.slice(-(MAX_TAP_HEARTS - 1)), heart]);
      window.setTimeout(() => setTaps((list) => list.filter((h) => h.id !== heart.id)), 1000);
    },
    [phase, zoom],
  );

  const photos = Array.from({ length: PHOTO_COUNT }, (_, i) => (data as Record<string, string | undefined>)[`photo_${i + 1}`]);
  // Optional photos (11, 12) are simply left out when empty; in the editor preview,
  // required ones show a placeholder so the composition is visible while uploading.
  const shownKey = photos
    .flatMap((src, i) => (src || (i < REQUIRED_PHOTOS && mode !== "live") ? [i] : []))
    .join(",");
  const { placements, cols } = useMemo(() => {
    const indices = shownKey ? shownKey.split(",").map(Number) : [];
    return layout === "desktop" ? arrangeDesktop(indices, letterH, sideW) : { placements: arrangeStack(indices), cols: 1 };
  }, [layout, letterH, sideW, shownKey]);
  const byGroup = (group: Group, col?: number) => placements.filter((p) => p.group === group && (col === undefined || p.col === col));
  const top = byGroup("top");
  const viewable = photos.flatMap((src, i) => (src ? [i] : []));

  // Photos arrive when they're on screen: the ones around the letter right after it
  // opens, the ones further down as they scroll into view.
  useEffect(() => {
    const root = rootRef.current;
    if (phase !== "open" || !root) return;
    const items = [...root.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in])")];
    if (typeof IntersectionObserver === "undefined") {
      items.forEach((el) => el.setAttribute("data-in", ""));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const elapsed = (performance.now() - openedAt.current) / 1000;
        let batch = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const planned = FIRST_PHOTO_S + Number(el.dataset.order ?? 0) * PHOTO_STEP_S - elapsed;
          el.style.setProperty("--d", `${Math.max(planned, batch * PHOTO_STEP_S).toFixed(2)}s`);
          el.setAttribute("data-in", "");
          io.unobserve(el);
          batch++;
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [phase, placements]);

  // Lightbox keyboard: Escape closes, arrows move between photos.
  useEffect(() => {
    if (zoom === null) return;
    zoomCloseRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeZoom();
      else if (e.key === "ArrowRight") stepZoom(1);
      else if (e.key === "ArrowLeft") stepZoom(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function openZoom(index: number, opener: HTMLElement) {
    if (!photos[index]) return;
    zoomOpener.current = opener;
    setZoom(index);
  }
  function closeZoom() {
    setZoom(null);
    zoomOpener.current?.focus({ preventScroll: true });
  }
  function stepZoom(dir: 1 | -1) {
    if (zoom === null || viewable.length < 2) return;
    const at = viewable.indexOf(zoom);
    setZoom(viewable[(at + dir + viewable.length) % viewable.length]!);
  }

  const greeting = data.greeting?.trim() || "Dear";
  const signOff = data.sign_off?.trim() || "With all my love,";
  const paragraphs = data.letter_body.split(/\n\s*\n/).filter((p) => p.trim());
  const Pin = FLOWER_SET[2]!;
  const TopFlower = FLOWER_SET[1]!;
  const Bud = FLOWER_SET[3]!;
  const Rose = FLOWER_SET[0]!;
  const Petal = FLOWER_SET[4]!;
  const Leaf = FLOWER_SET[5]!;

  function renderPhoto(p: Placement, pos: number) {
    const src = photos[p.index];
    const look = styleOf(p.index);
    const style = {
      "--r": `${look.r}deg`,
      "--sway": `${look.sway}deg`,
      "--lift": `${look.lift}px`,
      "--wd": `${look.wd}s`,
      "--aspect": look.aspect,
      "--d": `${(FIRST_PHOTO_S + p.order * PHOTO_STEP_S).toFixed(2)}s`,
      "--from-x": p.group === "right" ? "80px" : "-80px",
      "--align": p.align,
      "--f": SIZE_FACTOR[look.size],
      "--w": p.widthPx ? `${p.widthPx}px` : undefined,
      "--bw": `${BOTTOM_REM[look.size]}rem`,
    } as CSSProperties;
    return (
      <figure
        key={p.index}
        className={`${s.slot} ${s[enterFor(p.group, pos)]}`}
        style={style}
        data-reveal
        data-order={p.order}
        data-deco={look.deco}
      >
        <button
          type="button"
          className={s.polaroid}
          disabled={!src}
          tabIndex={phase === "open" ? 0 : -1}
          aria-label={`View memory ${p.index + 1}`}
          onClick={(e) => openZoom(p.index, e.currentTarget)}
        >
          {src ? (
            <img className={s.photo} src={src} alt="" loading="eager" decoding="async" fetchPriority="low" />
          ) : (
            <span className={s.placeholder}>Photo {p.index + 1}</span>
          )}
        </button>
      </figure>
    );
  }

  return (
    <div ref={rootRef} className={s.root} data-phase={phase} data-layout={layout} style={vars} onPointerDown={onTap}>
      <div className={s.bgBase} aria-hidden />
      <div className={s.bgWarm} aria-hidden />

      {/* Floating hearts and drifting petals — sticky so they stay in view; behind everything. */}
      <div className={s.atmos} aria-hidden>
        <div className={s.atmosInner}>
          {phase === "open" && (
            <>
              {BG_HEARTS.map((h, i) => (
                <span key={i} className={s.floatHeart} style={{ left: h.left, "--t": h.t, "--d": h.d, "--x": h.x, "--o": h.o } as CSSProperties}>
                  <HeartIcon size={h.size} />
                </span>
              ))}
              {PETALS.map((p, i) => (
                <span
                  key={i}
                  className={s.petal}
                  style={{ left: p.left, width: p.size, height: p.size, "--t": p.t, "--d": p.d, "--x": p.x, "--spin": p.r } as CSSProperties}
                >
                  <Petal />
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Lightbox — sticky like the hearts, so it covers the screen inside preview frames too. */}
      {zoom !== null && photos[zoom] && (
        <div className={s.zoomLayer}>
          <div className={s.zoom} role="dialog" aria-modal="true" aria-label={`Memory ${zoom + 1}`} data-no-hearts onClick={closeZoom}>
            <figure className={s.zoomCard} onClick={(e) => e.stopPropagation()}>
              <img key={zoom} className={s.zoomPhoto} src={photos[zoom]} alt={`Memory ${zoom + 1}`} />
              <figcaption className={s.zoomCaption}>
                <HeartIcon size={12} /> {viewable.indexOf(zoom) + 1} of {viewable.length}
              </figcaption>
            </figure>
            <button ref={zoomCloseRef} type="button" className={s.zoomClose} onClick={closeZoom} aria-label="Close">
              ×
            </button>
            {viewable.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${s.zoomNav} ${s.zoomPrev}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    stepZoom(-1);
                  }}
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className={`${s.zoomNav} ${s.zoomNext}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    stepZoom(1);
                  }}
                  aria-label="Next photo"
                >
                  ›
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* The envelope, alone */}
      <section className={s.cover} aria-hidden={phase === "open"}>
        <div className={s.envelopeWrap}>
          <button
            type="button"
            className={s.envelope}
            onClick={open}
            disabled={phase !== "closed"}
            aria-label={`Open your letter, ${data.recipient_name}`}
          >
            <span className={s.envGlow} aria-hidden />
            <span className={s.envBack} aria-hidden />
            <span className={s.envPeek} aria-hidden />
            <span className={s.envFront} aria-hidden>
              <svg viewBox="0 0 300 200" preserveAspectRatio="none">
                <path d="M0 8 Q0 0 8 0 L150 112 L292 0 Q300 0 300 8 V192 Q300 200 292 200 H8 Q0 200 0 192z" fill="var(--env)" />
                <path d="M0 200 L130 100 Q150 88 170 100 L300 200z" fill="color-mix(in srgb, var(--env) 88%, #000 4%)" />
                <path d="M0 8 L130 104 M300 8 L170 104" stroke="rgb(120 80 70 / 0.12)" strokeWidth="1.2" fill="none" />
              </svg>
              <span className={s.envName}>{data.recipient_name}</span>
            </span>
            <span className={s.envFlap} aria-hidden>
              <svg viewBox="0 0 300 124" preserveAspectRatio="none">
                <path d="M0 6 Q0 0 8 0 H292 Q300 0 300 6 L164 116 Q150 126 136 116z" fill="color-mix(in srgb, var(--env) 92%, #fff)" />
                <path d="M0 6 L136 116 Q150 126 164 116 L300 6" stroke="rgb(120 80 70 / 0.14)" strokeWidth="1.2" fill="none" />
              </svg>
              <span className={s.seal}>
                <HeartIcon size={18} />
              </span>
            </span>
          </button>
          <p className={s.hint}>
            <HeartIcon size={12} /> Tap to open your letter
          </p>
        </div>
      </section>

      {/* Flowers thrown into the air (removed once they've landed) */}
      {burst && (
        <div className={s.burst} aria-hidden>
          {BURST.map((f, i) => {
            const Art = FLOWER_SET[f.art % FLOWER_SET.length]!;
            return (
              <span
                key={i}
                className={s.flower}
                style={
                  {
                    "--x": `${f.x}px`,
                    "--peak": `${f.peak}px`,
                    "--fall": `${f.fall}px`,
                    "--rot": `${f.rot}deg`,
                    "--size": `${f.size}px`,
                    "--dur": `${f.dur}ms`,
                    "--delay": `${f.delay}ms`,
                  } as CSSProperties
                }
              >
                <Art />
              </span>
            );
          })}
        </div>
      )}

      {/* The letter and the memories around it */}
      <div className={s.scene} aria-hidden={phase !== "open"}>
        <div className={s.top}>
          {top[0] && renderPhoto(top[0], 0)}
          <span className={s.topFlower} aria-hidden>
            <TopFlower />
          </span>
          {top[1] && renderPhoto(top[1], 1)}
        </div>

        <div className={s.letterArea} data-no-hearts>
          <div className={s.letterShadow}>
            <span className={s.pinFlower} aria-hidden>
              <Pin />
            </span>
            <span className={s.stamp} aria-hidden>
              <svg className={s.stampArt} viewBox="0 0 60 72">
                <rect x="2" y="2" width="56" height="68" fill="#fffdf9" />
                {/* round "holes" along the edge = perforation */}
                <rect x="2" y="2" width="56" height="68" fill="none" stroke="var(--paper)" strokeWidth="4.2" strokeDasharray="0 6.2" strokeLinecap="round" />
                <rect x="8" y="8" width="44" height="56" fill="color-mix(in srgb, var(--lw-glow) 55%, #fff)" />
                <path d="M30 50c-8-5.5-13-11-13-16.5a6.5 6.5 0 0 1 13-2.2 6.5 6.5 0 0 1 13 2.2c0 5.5-5 11-13 16.5z" fill="var(--lw-accent)" />
                <text x="30" y="60" textAnchor="middle" fontSize="6" fill="var(--lw-accent)" letterSpacing="0.6">
                  LOVE
                </text>
              </svg>
              <svg className={s.postmark} viewBox="0 0 100 100">
                <defs>
                  <path id={postmarkId} d="M50 50 m-36 0 a36 36 0 1 1 72 0 a36 36 0 1 1 -72 0" />
                </defs>
                <circle cx="50" cy="50" r="44" />
                <circle cx="50" cy="50" r="28" />
                <text>
                  <textPath href={`#${postmarkId}`}>SEALED WITH LOVE · SEALED WITH LOVE ·</textPath>
                </text>
              </svg>
            </span>
            <article ref={letterRef} tabIndex={-1} className={s.letter} aria-label={`A letter for ${data.recipient_name}`}>
              <h1 className={s.greeting}>
                <span className={s.ink}>
                  {greeting} {data.recipient_name},
                </span>
              </h1>
              <p className={s.para} style={{ "--i": 0 } as CSSProperties}>
                {data.letter_opening}
              </p>
              {paragraphs.map((p, i) => (
                <p key={i} className={s.para} style={{ "--i": i + 1 } as CSSProperties}>
                  {p}
                </p>
              ))}
              <p className={`${s.para} ${s.closing}`} style={{ "--i": paragraphs.length + 1 } as CSSProperties}>
                {data.letter_closing}
              </p>
              <div className={s.signBlock}>
                <div>
                  <p className={s.signOff}>{signOff}</p>
                  <p className={s.signature}>
                    <span className={`${s.ink} ${s.inkLate}`}>{data.sender_name}</span>
                  </p>
                </div>
                <span className={s.wax} aria-hidden>
                  <HeartIcon size={20} />
                </span>
              </div>
            </article>
          </div>
        </div>

        <div className={s.rest}>
          <div ref={sideRef} className={s.left}>
            {layout === "desktop" &&
              Array.from({ length: cols }, (_, c) => (
                <div key={c} className={s.col}>
                  {byGroup("left", c).map(renderPhoto)}
                </div>
              ))}
          </div>
          <div className={s.right}>
            {layout === "desktop" &&
              Array.from({ length: cols }, (_, c) => (
                <div key={c} className={s.col}>
                  {byGroup("right", c).map(renderPhoto)}
                </div>
              ))}
          </div>
          <div className={s.bottom}>{byGroup("bottom").map(renderPhoto)}</div>
          <span className={s.restFlower} aria-hidden>
            <Bud />
          </span>
        </div>

        {/* A little keepsake line to close the page */}
        <div className={s.flourish} data-reveal data-order={placements.length} aria-hidden>
          <span className={s.flourishLine}>
            <Leaf />
            <Rose />
            <Leaf />
          </span>
          <p className={s.names}>
            {data.recipient_name} <HeartIcon size={16} /> {data.sender_name}
          </p>
        </div>
      </div>

      {taps.map((h) => (
        <span key={h.id} className={s.tapHeart} style={{ left: h.x, top: h.y }} aria-hidden>
          <HeartIcon size={h.size} />
        </span>
      ))}

      <footer className={s.footer}>
        <p>Made with ♥ by Love, Written</p>
        <p style={{ marginTop: "0.4rem" }}>
          <Link href="/" target={mode === "preview" ? "_blank" : undefined} rel="noopener">
            Make a surprise for someone →
          </Link>
        </p>
      </footer>
    </div>
  );
}
