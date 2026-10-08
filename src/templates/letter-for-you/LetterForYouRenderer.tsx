"use client";

/* eslint-disable @next/next/no-img-element -- media is pre-optimized and served via signed URLs */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { RendererProps } from "../types";
import { getFont, getTheme, themeVars } from "../styles";
import { HeartIcon } from "../shared/icons";
import { BURST, FLOWER_SET } from "./flowers";
import { arrangeDesktop, arrangeStack, PHOTO_STYLES, SIZE_REM, type Group, type Placement } from "./arrange";
import type { LetterForYouData } from "./definition";
import s from "./letter-for-you.module.css";

/**
 * A Letter for You — trusted renderer.
 *
 * Timeline after the envelope is tapped (all CSS-driven; this component only flips phases):
 *   0ms     flap swings open, wax seal fades, a sheet of paper peeks out
 *   1050ms  phase "open": envelope drops away, the letter rises, flowers burst upward,
 *           the background starts warming, photos arrive one by one (≈1s → 2.4s)
 *   +3s     flowers have landed and are removed; photos keep a gentle sway
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

function enterFor(group: Group, pos: number): Enter {
  if (group === "left" || group === "right") return "enterSide";
  const cycle: Enter[] = group === "top" ? ["enterTurn", "enterPop"] : ["enterRise", "enterPop", "enterTurn"];
  return cycle[pos % cycle.length]!;
}

const OPEN_AT_MS = 1050;
const BURST_CLEANUP_MS = 4200;
const MAX_TAP_HEARTS = 14;

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

let tapId = 0;

export function LetterForYouRenderer({ data, mode }: RendererProps<LetterForYouData>) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [burst, setBurst] = useState(false);
  const [layout, setLayout] = useState<Layout>("stack");
  const [letterH, setLetterH] = useState(0);
  const [taps, setTaps] = useState<{ id: number; x: number; y: number; size: number }[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const theme = getTheme(data.theme);
  const vars = themeVars(theme, getFont(data.story_font, "garamond"), getFont(data.final_font, "parisienne")) as CSSProperties;

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  // Measure the page width and the letter's real height (the scene is laid out, hidden,
  // even before the envelope opens) so the photos can be arranged around it.
  useEffect(() => {
    const root = rootRef.current;
    const letter = letterRef.current;
    if (!root || !letter) return;
    const measure = () => {
      setLayout(root.offsetWidth >= DESKTOP_MIN_PX ? "desktop" : "stack");
      setLetterH(letter.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    ro.observe(letter);
    return () => ro.disconnect();
  }, []);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  function open() {
    if (phase !== "closed") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase("open");
      later(() => letterRef.current?.focus({ preventScroll: true }), 50);
      return;
    }
    setPhase("opening");
    later(() => {
      setPhase("open");
      setBurst(true);
    }, OPEN_AT_MS);
    later(() => setBurst(false), OPEN_AT_MS + BURST_CLEANUP_MS);
    later(() => letterRef.current?.focus({ preventScroll: true }), OPEN_AT_MS + 900);
  }

  /** Tap the background → a little heart pops up there. Cleaned up after its animation. */
  const onTap = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (phase !== "open") return;
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
    [phase],
  );

  const photos = Array.from({ length: PHOTO_COUNT }, (_, i) => (data as Record<string, string | undefined>)[`photo_${i + 1}`]);
  // Optional photos (11, 12) are simply left out when empty; in the editor preview,
  // required ones show a placeholder so the composition is visible while uploading.
  const shownKey = photos
    .flatMap((src, i) => (src || (i < REQUIRED_PHOTOS && mode !== "live") ? [i] : []))
    .join(",");
  const placements = useMemo(() => {
    const indices = shownKey ? shownKey.split(",").map(Number) : [];
    return layout === "desktop" ? arrangeDesktop(indices, letterH) : arrangeStack(indices);
  }, [layout, letterH, shownKey]);
  const byGroup = (group: Group) => placements.filter((p) => p.group === group);
  const top = byGroup("top");

  const greeting = data.greeting?.trim() || "Dear";
  const signOff = data.sign_off?.trim() || "With all my love,";
  const paragraphs = data.letter_body.split(/\n\s*\n/).filter((p) => p.trim());
  const Pin = FLOWER_SET[2]!;
  const TopFlower = FLOWER_SET[1]!;
  const Bud = FLOWER_SET[3]!;

  function renderPhoto(p: Placement, pos: number) {
    const src = photos[p.index];
    const look = PHOTO_STYLES[p.index % PHOTO_STYLES.length]!;
    const style = {
      "--r": `${look.r}deg`,
      "--sway": `${look.sway}deg`,
      "--lift": `${look.lift}px`,
      "--wd": `${look.wd}s`,
      "--w": `${SIZE_REM[look.size]}rem`,
      "--aspect": look.aspect,
      "--d": `${0.85 + p.order * 0.12}s`,
      "--from-x": p.group === "right" ? "70px" : "-70px",
      "--align": p.align,
    } as CSSProperties;
    return (
      <figure key={p.index} className={`${s.slot} ${s[enterFor(p.group, pos)]}`} style={style}>
        <div className={s.polaroid}>
          {src ? (
            <img className={s.photo} src={src} alt={`Memory ${p.index + 1}`} loading="eager" decoding="async" fetchPriority="low" />
          ) : (
            <div className={s.placeholder}>Photo {p.index + 1}</div>
          )}
        </div>
      </figure>
    );
  }

  return (
    <div ref={rootRef} className={s.root} data-phase={phase} data-layout={layout} style={vars} onPointerDown={onTap}>
      <div className={s.bgBase} aria-hidden />
      <div className={s.bgWarm} aria-hidden />

      {/* Floating hearts — sticky so they stay in view while reading; behind everything. */}
      <div className={s.atmos} aria-hidden>
        <div className={s.atmosInner}>
          {phase === "open" &&
            BG_HEARTS.map((h, i) => (
              <span key={i} className={s.floatHeart} style={{ left: h.left, "--t": h.t, "--d": h.d, "--x": h.x, "--o": h.o } as CSSProperties}>
                <HeartIcon size={h.size} />
              </span>
            ))}
        </div>
      </div>

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
            <article ref={letterRef} tabIndex={-1} className={s.letter} aria-label={`A letter for ${data.recipient_name}`}>
              <h1 className={s.greeting}>
                {greeting} {data.recipient_name},
              </h1>
              <p className={s.para}>{data.letter_opening}</p>
              {paragraphs.map((p, i) => (
                <p key={i} className={s.para}>
                  {p}
                </p>
              ))}
              <p className={`${s.para} ${s.closing}`}>{data.letter_closing}</p>
              <p className={s.signOff}>{signOff}</p>
              <p className={s.signature}>{data.sender_name}</p>
            </article>
          </div>
        </div>

        <div className={s.rest}>
          <div className={s.left}>{byGroup("left").map(renderPhoto)}</div>
          <div className={s.right}>{byGroup("right").map(renderPhoto)}</div>
          <div className={s.bottom}>{byGroup("bottom").map(renderPhoto)}</div>
          <span className={s.restFlower} aria-hidden>
            <Bud />
          </span>
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
