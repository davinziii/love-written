"use client";

/* eslint-disable @next/next/no-img-element -- media is pre-optimized and served via signed URLs */

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { preload } from "react-dom";
import type { RendererProps } from "../types";
import { getFont } from "../styles";
import { PAGE_COUNT, REQUIRED_PAGES, type JournalData } from "./definition";
import { layoutFor, type Corner, type StickerSpot } from "./layouts";
import { getBackground, getWordColor } from "./palette";
import s from "./journal.module.css";

/**
 * Journal — trusted renderer.
 *
 * The current page sits in the middle of a fan of pages: pages already seen fold away to the
 * left, pages still to come to the right. Turning a page is a rigid "hardcover" flip around a
 * line down the middle of the page:
 *
 *   underneath  left half of the old page | right half of the new page
 *   the leaf    front = right half of the old page, back = left half of the new page,
 *               rotating 180° (mirrored when going back)
 *
 * All motion is CSS (transform/opacity); this component only flips state.
 * It never checks payment, access, editing, expiry or storage.
 */

const TURN_MS = 900;
const AUTOPLAY_MS = 4200;
const SWIPE_PX = 40;
/** At most this many pages fanned out on each side. */
const MAX_SHEETS = 7;
/** A fan this deep fades out over its last two pages instead of ending on a hard edge. */
const FADE_FROM = 5;
/** The book's CSS perspective in page widths (journal.module.css: 2.4 × page width). */
const PERSPECTIVE = 2.4;

type Side = "left" | "right";

interface Page {
  n: number;
  photo: string | undefined;
  extras: string[];
  words: string;
  color: ReturnType<typeof getWordColor>;
}
interface Turn {
  from: number;
  to: number;
  dir: 1 | -1;
}
interface Sheet {
  key: string;
  page: Page;
  k: number;
  /** 0 = solid; 1–2 = the last pages of a deep fan, fading out. */
  fade: number;
  /** The page being turned away from — hidden until the turn ends. */
  hidden: boolean;
}

export function JournalRenderer({ data, mode }: RendererProps<JournalData>) {
  const fields = data as Record<string, string | undefined>;
  const pages: Page[] = [];
  for (let n = 1; n <= PAGE_COUNT; n++) {
    const photo = fields[`page_photo_${n}`];
    // Live: only pages with a photo. Editor/catalog: required pages show as placeholders.
    if (!photo && (mode === "live" || n > REQUIRED_PAGES)) continue;
    pages.push({
      n,
      photo,
      extras: [fields[`page_extra_${n}_1`], fields[`page_extra_${n}_2`]].filter((x): x is string => Boolean(x)),
      words: fields[`page_words_${n}`]?.trim() ?? "",
      color: getWordColor(fields[`page_words_color_${n}`]),
    });
  }

  const [at, setAt] = useState(0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [view, setView] = useState<"book" | "grid">("book");
  const [playing, setPlaying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);

  const count = pages.length;
  // Pages can disappear while the customer edits; never point past the end.
  const cur = Math.min(at, Math.max(count - 1, 0));
  const shown = turn ? turn.to : cur;

  function goTo(target: number) {
    if (turn || target === cur || target < 0 || target >= count) return;
    if (Math.abs(target - cur) > 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAt(target);
      return;
    }
    setTurn({ from: cur, to: target, dir: target > cur ? 1 : -1 });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setAt(target);
      setTurn(null);
    }, TURN_MS);
  }

  // Listeners and timers call the latest goTo without re-subscribing on every render.
  const goToRef = useRef(goTo);
  useEffect(() => {
    goToRef.current = goTo;
  });

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Slideshow: turn every few seconds; after the last page, go back to the first.
  useEffect(() => {
    if (!playing || turn || view !== "book" || count < 2) return;
    const t = window.setTimeout(() => goToRef.current(cur + 1 < count ? cur + 1 : 0), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [playing, turn, view, cur, count]);

  // Arrow keys: anywhere on the live page; in the editor only while the preview has focus.
  useEffect(() => {
    if (view !== "book") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const scroller = rootRef.current?.closest("[data-lw-scroll]");
      if (scroller && !scroller.contains(document.activeElement)) return;
      setPlaying(false);
      goToRef.current(cur + (e.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, cur]);

  // Warm up the neighbouring pages' extra photos so a turn never shows them loading.
  for (const i of [shown - 1, shown + 1]) {
    for (const src of pages[i]?.extras ?? []) preload(src, { as: "image" });
  }

  function step(dir: 1 | -1) {
    setPlaying(false);
    goTo(cur + dir);
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1);
  }

  // The fans: pages already seen on the left (nearest first), pages to come on the right.
  const sheets = (side: Side): Sheet[] => {
    const idx =
      side === "left"
        ? Array.from({ length: shown }, (_, i) => shown - 1 - i)
        : Array.from({ length: Math.max(0, count - shown - 1) }, (_, i) => shown + 1 + i);
    const shownIdx = idx.slice(0, MAX_SHEETS);
    const n = shownIdx.length;
    return shownIdx.map((i, j) => ({
      key: `p${pages[i]!.n}`,
      page: pages[i]!,
      k: j + 1,
      fade: n >= FADE_FROM ? Math.max(0, j + 1 - (n - 2)) : 0,
      hidden: turn?.from === i,
    }));
  };

  const bg = getBackground(data.background);
  const font = getFont(data.words_font, "caveat");
  const style = {
    "--bg-top": bg.top,
    "--bg-bottom": bg.bottom,
    "--words-font": `var(${font.cssVar})`,
    "--words-scale": String(font.scale ?? 1),
    "--words-style": font.italic ? "italic" : "normal",
  } as CSSProperties;

  return (
    <div ref={rootRef} className={s.root} style={style}>
      <header className={s.header}>
        <div className={s.headerSide}>
          <button
            type="button"
            className={`${s.round} ${view === "book" ? s.roundActive : ""}`}
            onClick={() => setView("book")}
            aria-pressed={view === "book"}
            aria-label="Book view"
          >
            <BookIcon />
          </button>
          <button
            type="button"
            className={`${s.round} ${view === "grid" ? s.roundActive : ""}`}
            onClick={() => {
              setPlaying(false);
              setView("grid");
            }}
            aria-pressed={view === "grid"}
            aria-label="See all pages"
          >
            <GridIcon />
          </button>
        </div>
        <div className={s.heading}>
          <h1 className={s.title}>{data.journal_title?.trim() || "Journal"}</h1>
          <p className={s.count}>
            <PenIcon /> {count} {count === 1 ? "Page" : "Pages"}
          </p>
        </div>
        <div className={`${s.headerSide} ${s.headerRight}`} aria-hidden>
          <span className={s.roundGhost}>
            <SearchIcon />
          </span>
          <span className={s.roundGhost}>
            <MenuIcon />
          </span>
        </div>
      </header>

      {view === "book" ? (
        <div className={s.main}>
          <div
            className={s.scene}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipe.current = null)}
            role="group"
            aria-roledescription="journal"
            aria-label={`Page ${shown + 1} of ${count}`}
          >
            <div className={s.book}>
              {sheets("left").map((sh) => (
                <FanSheet key={sh.key} sheet={sh} side="left" onOpen={() => step(-1)} />
              ))}
              {sheets("right").map((sh) => (
                <FanSheet key={sh.key} sheet={sh} side="right" onOpen={() => step(1)} />
              ))}

              <div className={s.current} aria-live="polite">
                {count > 0 && <span className={s.pageShadow} aria-hidden />}
                {turn ? (
                  <TurningPage from={pages[turn.from]!} to={pages[turn.to]!} dir={turn.dir} />
                ) : count > 0 ? (
                  <PageFace key={pages[cur]!.n} page={pages[cur]!} className={s.whole} />
                ) : null}
              </div>
            </div>
            <span className={s.floor} aria-hidden />
          </div>

          <div className={s.controls}>
            <button type="button" className={s.control} onClick={() => step(-1)} disabled={cur === 0 && !turn} aria-label="Previous page">
              <ChevronIcon dir={-1} />
            </button>
            <button
              type="button"
              className={s.control}
              onClick={() => setPlaying((p) => !p)}
              disabled={count < 2}
              aria-label={playing ? "Pause slideshow" : "Play slideshow"}
              aria-pressed={playing}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" className={s.control} onClick={() => step(1)} disabled={cur >= count - 1 && !turn} aria-label="Next page">
              <ChevronIcon dir={1} />
            </button>
          </div>
        </div>
      ) : (
        <ul className={s.grid}>
          {pages.map((p, i) => (
            <li key={p.n}>
              <button
                type="button"
                className={s.gridItem}
                onClick={() => {
                  setAt(i);
                  setView("book");
                }}
                aria-label={`Open page ${i + 1}`}
              >
                <PageFace page={p} className={s.gridFace} />
                <span className={s.gridNo}>{i + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <footer className={s.footer}>
        <p>Made with ♥ by Love, Written</p>
        <p>
          <Link href="/" target={mode === "preview" ? "_blank" : undefined} rel="noopener">
            Make a surprise for someone →
          </Link>
        </p>
      </footer>
    </div>
  );
}

/* ─── The fan ────────────────────────────────────────────────────────────── */

function FanSheet({ sheet, side, onOpen }: { sheet: Sheet; side: Side; onOpen: () => void }) {
  const k = sheet.k;
  // Each page folds further away the deeper it is and is a little smaller, so its corners stay
  // within the current page's height. Its outer edge peeks out ~5% of a page beyond the one in
  // front (its inner part hides behind the current page): solve for the offset that puts the
  // edge there once perspective pulls it toward the middle. Units: page widths from the middle.
  // The angle stays gentle enough that every sheet still overlaps the one in front of it.
  const angle = Math.min(50 + 2 * k, 62);
  const rad = (angle * Math.PI) / 180;
  const scale = 0.97 - 0.025 * k;
  const edge = 0.53 + 0.05 * k;
  const origin = (edge * (PERSPECTIVE + Math.sin(rad) * scale)) / PERSPECTIVE - Math.cos(rad) * scale;
  const sign = side === "right" ? 1 : -1;
  // The sheet starts on top of the current page; move its inner edge to `origin`.
  const shift = sign * (origin + 0.5);
  const transform = `translate3d(${(shift * 100).toFixed(2)}%, 0, ${-3 * k}px) rotateY(${sign * angle}deg) scale(${scale.toFixed(3)})`;
  return (
    <button
      type="button"
      className={s.sheet}
      data-side={side}
      data-hidden={sheet.hidden ? "" : undefined}
      style={{ transform, zIndex: 20 - k, "--depth": k, "--fade": sheet.fade } as CSSProperties}
      onClick={onOpen}
      tabIndex={-1}
      aria-hidden
    >
      <PageFace page={sheet.page} lazy />
      <span className={s.sheetShade} />
    </button>
  );
}

/* ─── The hardcover page turn ────────────────────────────────────────────── */

function TurningPage({ from, to, dir }: { from: Page; to: Page; dir: 1 | -1 }) {
  const next = dir === 1;
  return (
    <>
      {/* Underneath: what stays put on each side of the fold. */}
      <Half page={next ? from : to} side="left" className={s.baseLeft} shade={next ? "land" : "lift"} />
      <Half page={next ? to : from} side="right" className={s.baseRight} shade={next ? "lift" : "land"} />
      {/* The stiff leaf that swings over the middle. */}
      <div className={s.leaf} data-dir={next ? "next" : "prev"}>
        <Half page={from} side={next ? "right" : "left"} className={s.leafFront} shade="front" />
        <Half page={to} side={next ? "left" : "right"} className={s.leafBack} shade="back" />
      </div>
    </>
  );
}

function Half({
  page,
  side,
  className,
  shade,
}: {
  page: Page;
  side: Side;
  className: string | undefined;
  shade: "front" | "back" | "lift" | "land";
}) {
  return (
    <div className={`${s.half} ${className ?? ""}`} data-side={side}>
      <div className={s.halfInner}>
        <PageFace page={page} />
      </div>
      <span className={s.shade} data-shade={shade} data-side={side} aria-hidden />
    </div>
  );
}

/* ─── One page: full photo, framed extras, words ─────────────────────────── */

function PageFace({ page, className, lazy }: { page: Page; className?: string | undefined; lazy?: boolean }) {
  const layout = layoutFor(page.n);
  const corner: Corner = page.extras.length ? layout.words : "bl";
  return (
    <div className={`${s.face} ${className ?? ""}`} style={{ "--wc": page.color.value, "--ws": page.color.shadow } as CSSProperties}>
      {page.photo ? (
        <img className={s.photo} src={page.photo} alt="" loading={lazy ? "lazy" : undefined} decoding="async" draggable={false} />
      ) : (
        <span className={s.placeholder} />
      )}
      {page.extras.map((src, i) => (
        <Sticker key={i} src={src} spot={layout.stickers[i]!} lazy={lazy} />
      ))}
      {page.words && (
        <p className={s.words} data-corner={corner}>
          {page.words}
        </p>
      )}
    </div>
  );
}

function Sticker({ src, spot, lazy }: { src: string; spot: StickerSpot; lazy: boolean | undefined }) {
  return (
    <span
      className={s.sticker}
      data-frame={spot.frame}
      style={
        {
          left: `${spot.left}%`,
          top: `${spot.top}%`,
          width: `${spot.width}%`,
          "--r": `${spot.rotate}deg`,
          "--aspect": spot.aspect,
        } as CSSProperties
      }
    >
      <img src={src} alt="" loading={lazy ? "lazy" : undefined} decoding="async" draggable={false} />
    </span>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────────────── */

const icon = { viewBox: "0 0 24 24", "aria-hidden": true, className: s.icon } as const;

function BookIcon() {
  return (
    <svg {...icon}>
      <path d="M12 6.5C10 5 7 4.6 4 5v13c3-.4 6 0 8 1.5M12 6.5C14 5 17 4.6 20 5v13c-3-.4-6 0-8 1.5M12 6.5v13" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg {...icon}>
      <path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg {...icon}>
      <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M15 15l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg {...icon}>
      <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={s.penIcon}>
      <path d="M4 20l1-4L15.5 5.5a2.1 2.1 0 0 1 3 3L8 19zM13.5 7.5l3 3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronIcon({ dir }: { dir: 1 | -1 }) {
  return (
    <svg {...icon}>
      <path d={dir === 1 ? "M9.5 5.5 16 12l-6.5 6.5" : "M14.5 5.5 8 12l6.5 6.5"} stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg {...icon}>
      <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z" fill="currentColor" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg {...icon}>
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
    </svg>
  );
}
