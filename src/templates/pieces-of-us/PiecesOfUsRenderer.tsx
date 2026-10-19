"use client";

/* eslint-disable @next/next/no-img-element -- media is pre-optimized and served via signed URLs */

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { preload } from "react-dom";
import type { RendererProps } from "../types";
import { getFont } from "../styles";
import { MAX_PUZZLES, getThemeColors, gridSize, type PiecesOfUsData } from "./definition";
import { makePuzzle, cutLines } from "./geometry";
import { initialStory, reduce } from "./machine";
import { Puzzle } from "./Puzzle";
import { createSound, type Sound } from "./sound";
import s from "./pieces-of-us.module.css";

/**
 * Pieces of Us — trusted renderer.
 *
 *   INVITE   a sealed envelope addressed to them → "Put us back together ♡"
 *   PUZZLE   one photo at a time, cut into real jigsaw pieces (Puzzle.tsx)
 *   MEMORY   the finished photo as a Polaroid; flip it for the hidden message
 *   MISSING  a heart with one golden piece missing — they drag or tap it in
 *   LETTER   the love letter (read again, see the memories, or replay)
 *
 * Only the active puzzle is mounted. It never checks payment, access, editing, expiry or storage.
 */

const DEFAULT_INVITE = "I scattered a few of my favorite memories. Will you help me put them back together?";
const DEFAULT_CAPTIONS = ["The day it all started", "Our favorite adventure", "Us, always"];
const DEFAULT_GREETING = "My love,";
const DEFAULT_SIGNATURE = "Forever yours,";
const FAVORITE = "Of all the pieces in my life, you're my favorite.";

/** Shown in the editor while a puzzle's photo isn't uploaded yet. */
const HEART_PICTURE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FBE6EA"/><stop offset="1" stop-color="#F3C4CF"/></linearGradient></defs><rect width="800" height="800" fill="url(#g)"/><circle cx="160" cy="170" r="70" fill="#fff" opacity=".35"/><circle cx="660" cy="640" r="110" fill="#fff" opacity=".25"/><path d="M400 650C250 540 140 450 140 320c0-90 70-160 156-160 54 0 98 26 124 70 26-44 70-70 124-70 86 0 156 70 156 160 0 130-110 220-260 330z" fill="#E75B73"/><path d="M290 290c-30 10-50 40-50 70" stroke="#fff" stroke-width="22" stroke-linecap="round" fill="none" opacity=".55"/></svg>',
  );

type Memory = { photo: string; caption: string; message: string };

export function PiecesOfUsRenderer({ data, mode }: RendererProps<PiecesOfUsData>) {
  const fields = data as Record<string, string | undefined>;
  const colors = getThemeColors(data.theme);
  const letterFont = getFont(data.letter_font, "lora");
  const n = gridSize(data.difficulty);
  const wanted = Math.min(MAX_PUZZLES, Math.max(1, Number(data.puzzle_count) || 1));

  // Live: only puzzles that have a photo. Editor: every chosen puzzle (a heart until a photo is added).
  const memories: Memory[] = [];
  for (let i = 1; i <= wanted; i++) {
    const photo = fields[`memory_photo_${i}`];
    if (!photo && mode === "live") continue;
    memories.push({
      photo: photo || HEART_PICTURE,
      caption: fields[`memory_caption_${i}`]?.trim() || DEFAULT_CAPTIONS[i - 1]!,
      message: fields[`memory_message_${i}`]?.trim() ?? "",
    });
  }
  if (memories.length === 0) memories.push({ photo: HEART_PICTURE, caption: DEFAULT_CAPTIONS[0]!, message: "" });

  const [story, dispatch] = useReducer(reduce, memories.length, initialStory);
  // The editor can change how many puzzles there are while someone is playing: start over then.
  const total = memories.length;
  useEffect(() => {
    dispatch({ type: "setTotal", total });
  }, [total]);

  const [sound] = useState<Sound | null>(() => (typeof window === "undefined" ? null : createSound()));
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => () => sound?.close(), [sound]);
  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      if (!on) sound?.wake();
      return !on;
    });
  }, [sound]);

  // Warm up the first photo while they read the invitation.
  if (story.scene === "INVITE" && memories[0]) preload(memories[0].photo, { as: "image" });

  const rootRef = useRef<HTMLDivElement>(null);
  const { scene, current: puzzleIndex } = story;
  // Each new scene starts at the top (the preview frame scrolls itself, the live page scrolls the window).
  useEffect(() => {
    const scroller = rootRef.current?.closest<HTMLElement>("[data-lw-scroll]");
    if (scroller) scroller.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [scene, puzzleIndex]);

  const onSolved = useCallback(() => dispatch({ type: "solved" }), [dispatch]);

  const vars = {
    "--desk": colors.desk,
    "--desk-deep": colors.deskDeep,
    "--paper": colors.paper,
    "--accent": colors.accent,
    "--accent-deep": colors.accentDeep,
    "--ink": colors.ink,
    "--tape": colors.tape,
    "--gold": colors.gold,
    "--letter-font": `var(${letterFont.cssVar})`,
  } as CSSProperties;

  const current = memories[Math.min(story.current, memories.length - 1)]!;
  const doneMemories = memories.slice(0, story.done);

  return (
    <div ref={rootRef} className={s.root} style={vars} data-scene={story.scene}>
      {story.scene === "INVITE" && (
        <Invitation
          name={data.recipient_name}
          message={data.invitation_message?.trim() || DEFAULT_INVITE}
          count={memories.length}
          onOpen={() => dispatch({ type: "open" })}
        />
      )}

      {story.scene === "PUZZLE" && (
        <Puzzle
          key={`${story.run}-${story.current}-${story.attempt}-${n}`}
          index={story.current}
          total={memories.length}
          image={current.photo}
          n={n}
          sound={sound}
          soundOn={soundOn}
          canShowMemories={story.done > 0}
          onToggleSound={toggleSound}
          onRestart={() => dispatch({ type: "overlay", overlay: "CONFIRM_RESTART" })}
          onMemories={() => dispatch({ type: "overlay", overlay: "GALLERY" })}
          onSolved={onSolved}
        />
      )}

      {story.scene === "MEMORY" && (
        <section className={s.scene}>
          <p className={s.kicker}>
            Memory {story.current + 1} of {memories.length} — unlocked
          </p>
          <Polaroid key={story.current} memory={current} tilt={story.current % 2 ? 2 : -2} reveal />
          <p className={s.flipHint}>Tap the photo to turn it over ♡</p>
          <button type="button" className={s.primary} onClick={() => dispatch({ type: "next" })}>
            {story.current + 1 < memories.length ? "Next memory →" : story.letterSeen ? "Back to the letter ♡" : "Continue ♡"}
          </button>
        </section>
      )}

      {story.scene === "MISSING" && <MissingPiece onPlaced={() => dispatch({ type: "goldenPlaced" })} sound={soundOn ? sound : null} />}

      {story.scene === "LETTER" && (
        <Letter
          key={story.run}
          greeting={data.letter_greeting?.trim() || DEFAULT_GREETING}
          message={data.letter_message ?? ""}
          signature={data.letter_signature?.trim() || DEFAULT_SIGNATURE}
          sender={data.sender_name}
          mode={mode}
          onMemories={() => dispatch({ type: "overlay", overlay: "GALLERY" })}
          onReplay={() => dispatch({ type: "overlay", overlay: "CONFIRM_REPLAY" })}
        />
      )}

      {story.overlay === "GALLERY" && (
        <Overlay label="Our memories" onClose={() => dispatch({ type: "closeOverlay" })}>
          <h2 className={s.overlayTitle}>Our memories</h2>
          <p className={s.flipHint}>Tap a photo to read its back.</p>
          <div className={s.galleryRow}>
            {doneMemories.map((m, i) => (
              <Polaroid key={i} memory={m} tilt={i % 2 ? 2.5 : -2.5} small />
            ))}
          </div>
          <button type="button" className={s.secondary} onClick={() => dispatch({ type: "closeOverlay" })} autoFocus>
            Close
          </button>
        </Overlay>
      )}

      {story.overlay === "CONFIRM_RESTART" && (
        <Overlay label="Restart this puzzle?" onClose={() => dispatch({ type: "closeOverlay" })}>
          <h2 className={s.overlayTitle}>Mix the pieces again?</h2>
          <p className={s.overlayText}>This puzzle starts over. Your finished memories stay.</p>
          <div className={s.overlayButtons}>
            <button type="button" className={s.secondary} onClick={() => dispatch({ type: "closeOverlay" })} autoFocus>
              Keep going
            </button>
            <button type="button" className={s.primary} onClick={() => dispatch({ type: "restartPuzzle" })}>
              Restart
            </button>
          </div>
        </Overlay>
      )}

      {story.overlay === "CONFIRM_REPLAY" && (
        <Overlay label="Replay from the beginning?" onClose={() => dispatch({ type: "closeOverlay" })}>
          <h2 className={s.overlayTitle}>Start from the beginning?</h2>
          <p className={s.overlayText}>Every puzzle is mixed up again and the envelope is sealed — just like the first time.</p>
          <div className={s.overlayButtons}>
            <button type="button" className={s.secondary} onClick={() => dispatch({ type: "closeOverlay" })} autoFocus>
              Not now
            </button>
            <button type="button" className={s.primary} onClick={() => dispatch({ type: "replay" })}>
              Replay
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

/* ─── Scene 1: the invitation ───────────────────────────────────────────── */

function Invitation({ name, message, count, onOpen }: { name: string; message: string; count: number; onOpen: () => void }) {
  const [opening, setOpening] = useState(false);
  const open = () => {
    if (opening) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onOpen();
    setOpening(true);
    window.setTimeout(onOpen, 750);
  };
  return (
    <section className={`${s.scene} ${s.invite}`} data-opening={opening || undefined}>
      <div className={s.envelope}>
        <span className={s.envBack} aria-hidden />
        <span className={s.inviteCard} aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className={s.envFront} aria-hidden />
        <span className={s.envFlap} aria-hidden />
        <span className={s.seal} aria-hidden>
          ♥
        </span>
        <p className={s.address}>
          <span>For</span> {name}
        </p>
      </div>
      <p className={s.inviteMessage}>{message}</p>
      <p className={s.inviteCount}>
        {count} {count === 1 ? "memory" : "memories"} to put back together
      </p>
      <button type="button" className={s.primary} onClick={open} autoFocus>
        Put us back together ♡
      </button>
    </section>
  );
}

/* ─── Scene 3: a Polaroid that flips ────────────────────────────────────── */

function Polaroid({ memory, tilt, reveal = false, small = false }: { memory: Memory; tilt: number; reveal?: boolean; small?: boolean }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      className={`${s.polaroid} ${small ? s.polaroidSmall : ""} ${reveal ? s.polaroidReveal : ""}`}
      style={{ "--tilt": `${tilt}deg` } as CSSProperties}
      data-flipped={flipped || undefined}
      onClick={() => setFlipped((f) => !f)}
      aria-label={flipped ? `Back of the photo: ${memory.message || memory.caption}` : `Photo: ${memory.caption}. Turn it over.`}
    >
      <span className={s.polaroidInner}>
        <span className={s.polaroidFront}>
          <span className={s.tape} aria-hidden />
          <img src={memory.photo} alt="" className={s.polaroidPhoto} draggable={false} />
          <span className={s.polaroidCaption}>{memory.caption}</span>
        </span>
        <span className={s.polaroidBack}>
          <span className={s.backMessage}>{memory.message || memory.caption}</span>
          <span className={s.backHeart} aria-hidden>
            ♥
          </span>
        </span>
      </span>
    </button>
  );
}

/* ─── Scene 4: the missing piece ────────────────────────────────────────── */

// One fixed scene, 400 × 520: the heart on top, the golden piece waiting below it.
const HEART =
  "M200 345C95 268 34 212 34 138 34 82 77 42 128 42c33 0 58 17 72 42 14-25 39-42 72-42 51 0 94 40 94 96 0 74-61 130-166 207z";
// The heart is itself a little jigsaw; its middle piece is the one that's missing.
const HEART_PUZZLE = makePuzzle(5, 400, 380, 11);
const HEART_LINES = cutLines(HEART_PUZZLE);
const HOLE = HEART_PUZZLE.pieces[12]!;
const PAD = HEART_PUZZLE.pad;
const BOX_W = HEART_PUZZLE.cellW + PAD * 2;
const BOX_H = HEART_PUZZLE.cellH + PAD * 2;
/** Where the golden piece waits (its cell corner), under the heart. */
const START = { x: 200 - HEART_PUZZLE.cellW / 2, y: 438 - HEART_PUZZLE.cellH / 2 };

function MissingPiece({ onPlaced, sound }: { onPlaced: () => void; sound: Sound | null }) {
  const [placed, setPlaced] = useState(false);
  const [ready, setReady] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const goldRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);

  /** Scene units → this box's CSS px. */
  const unit = () => (boxRef.current?.offsetWidth ?? 400) / 400;
  const settle = useCallback(() => {
    const el = goldRef.current;
    if (!el) return;
    const u = (boxRef.current?.offsetWidth ?? 400) / 400;
    el.style.transition = "transform .45s cubic-bezier(.2,.8,.2,1)";
    el.style.transform = `translate(${(HOLE.x - START.x) * u}px, ${(HOLE.y - START.y) * u}px)`;
    setPlaced(true);
    sound?.chime();
  }, [sound]);

  useEffect(() => {
    if (!placed) return;
    const t = window.setTimeout(() => setReady(true), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 200 : 1600);
    return () => window.clearTimeout(t);
  }, [placed]);

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (placed) return;
    capture(e.currentTarget, e.pointerId);
    e.currentTarget.style.transition = "none";
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };
  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const r = boxRef.current!.getBoundingClientRect();
    const k = r.width / boxRef.current!.offsetWidth || 1;
    const dx = (e.clientX - d.x) / k;
    const dy = (e.clientY - d.y) / k;
    if (Math.hypot(dx, dy) > 5) d.moved = true;
    e.currentTarget.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    const r = boxRef.current!.getBoundingClientRect();
    const k = r.width / boxRef.current!.offsetWidth || 1;
    const u = unit();
    const dx = (e.clientX - d.x) / k / u;
    const dy = (e.clientY - d.y) / k / u;
    const miss = Math.hypot(START.x + dx - HOLE.x, START.y + dy - HOLE.y);
    // A tap, or a drop anywhere near the opening, puts it in.
    if (!d.moved || miss < 70) return settle();
    e.currentTarget.style.transition = "transform .3s ease";
    e.currentTarget.style.transform = "";
  };

  return (
    <section className={`${s.scene} ${s.missing}`} data-placed={placed || undefined}>
      <p className={s.missingText}>
        You found all our memories&hellip;
        <br />
        but there&rsquo;s still one piece missing.
      </p>
      <div ref={boxRef} className={s.heartBox}>
        <svg viewBox="0 0 400 520" className={s.heartSvg} aria-hidden>
          <defs>
            <clipPath id="lw-pou-heart">
              <path d={HEART} />
            </clipPath>
            <linearGradient id="lw-pou-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFF1C2" />
              <stop offset=".45" stopColor="var(--gold)" />
              <stop offset="1" stopColor="#B07F22" />
            </linearGradient>
          </defs>
          <path d={HEART} className={s.heartFill} />
          <path d={HEART_LINES} className={s.heartLines} clipPath="url(#lw-pou-heart)" />
          <path d={HOLE.path} className={s.hole} />
        </svg>
        <button
          ref={goldRef}
          type="button"
          className={s.gold}
          style={{ left: `${((START.x - PAD) / 400) * 100}%`, top: `${((START.y - PAD) / 520) * 100}%`, width: `${(BOX_W / 400) * 100}%` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onClick={(e) => e.detail === 0 && settle()}
          disabled={placed}
          aria-label="The golden piece — place it in the heart"
        >
          <svg viewBox={`${HOLE.x - PAD} ${HOLE.y - PAD} ${BOX_W} ${BOX_H}`} aria-hidden>
            <path d={HOLE.path} fill="url(#lw-pou-gold)" className={s.goldPath} />
            <path
              transform={`translate(${HOLE.x + HEART_PUZZLE.cellW / 2 - 15} ${HOLE.y + HEART_PUZZLE.cellH / 2 - 14})`}
              d="M15 27C6 21 0 16 0 9 0 4 4 0 9 0c3 0 5 2 6 4 1-2 3-4 6-4 5 0 9 4 9 9 0 7-6 12-15 18z"
              fill="#fff"
              opacity=".7"
            />
          </svg>
        </button>
      </div>
      <p className={s.favorite} aria-live="polite">
        {placed ? FAVORITE : "Drag the golden piece into the heart — or just tap it."}
      </p>
      {/* Always laid out (hidden until ready), so nothing jumps when it appears. */}
      <button
        type="button"
        className={s.primary}
        onClick={onPlaced}
        style={ready ? undefined : { visibility: "hidden" }}
        tabIndex={ready ? undefined : -1}
        ref={(el) => {
          if (ready) el?.focus();
        }}
      >
        Open your letter ♡
      </button>
    </section>
  );
}

/* ─── Scene 5: the letter ───────────────────────────────────────────────── */

function Letter({
  greeting,
  message,
  signature,
  sender,
  mode,
  onMemories,
  onReplay,
}: {
  greeting: string;
  message: string;
  signature: string;
  sender: string;
  mode: "preview" | "live";
  onMemories: () => void;
  onReplay: () => void;
}) {
  const [readKey, setReadKey] = useState(0);
  const topRef = useRef<HTMLElement>(null);
  return (
    <section ref={topRef} className={`${s.scene} ${s.letterScene}`}>
      <article key={readKey} className={s.letter}>
        <span className={s.letterTape} aria-hidden />
        <h2 className={s.greeting}>{greeting}</h2>
        <div className={s.letterBody}>{message}</div>
        <p className={s.signature}>
          {signature}
          <span>{sender}</span>
        </p>
      </article>
      <div className={s.letterActions}>
        <button
          type="button"
          className={s.secondary}
          onClick={() => {
            setReadKey((k) => k + 1);
            topRef.current?.scrollIntoView({ block: "start" });
          }}
        >
          Read again
        </button>
        <button type="button" className={s.secondary} onClick={onMemories}>
          Our memories
        </button>
        <button type="button" className={s.secondary} onClick={onReplay}>
          Replay
        </button>
      </div>
      <p className={s.madeWith}>
        Made with ♥ by Love, Written ·{" "}
        <Link href="/" target={mode === "preview" ? "_blank" : undefined} rel="noopener">
          Make one →
        </Link>
      </p>
    </section>
  );
}

/* ─── Overlays ──────────────────────────────────────────────────────────── */

function Overlay({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div className={s.overlayCard} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** Keep getting a pointer's events even when it leaves the element (some browsers refuse; that's fine). */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // e.g. the pointer already ended
  }
}
