"use client";

/* eslint-disable @next/next/no-img-element -- media is pre-optimized and served via signed URLs */

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { preload } from "react-dom";
import type { RendererProps } from "../types";
import { getFont } from "../styles";
import { MEMORY_COUNT, getPalette, type PixelHeartHuntData } from "./definition";
import type { GameEvent, HeartHuntEngine } from "./engine";
import { GameCanvas } from "./GameCanvas";
import { ENVELOPE_BACK, ENVELOPE_FLAP, ENVELOPE_FRONT, Icon, PixelArt, SEAL } from "./PixelArt";
import { initialGame, reduce, type Phase } from "./machine";
import { createSound } from "./sound";
import s from "./pixel-heart-hunt.module.css";

/**
 * Pixel Heart Hunt — trusted renderer.
 *
 *   INTRO          "Someone sent you a little love…" (1.5s, skippable)
 *   PLAYING        aim the bow, shoot the five hearts
 *   MEMORY_REVEAL  each heart unlocks the next photo (the game waits)
 *   LETTER_UNLOCK  a floating pixel envelope — they open it when they're ready
 *   LETTER_OPEN    the love letter
 *   ENDLESS        keep popping hearts forever
 *
 * The phases live in one reducer (machine.ts), so the game can't be in two places at once.
 * It never checks payment, access, editing, expiry or storage.
 */

const INTRO_MS = 1600;
const REVEAL_AUTO_MS = 7000;
const DEFAULT_TITLE = "Heart Hunt";
const DEFAULT_INTRO = "Someone sent you a little love...";
const DEFAULT_GREETING = "To my favorite person,";
const DEFAULT_SIGNATURE = "Love, always ♡";
const KEY_AIM_STEP = (6 * Math.PI) / 180;

type Memory = { photo?: string; caption: string };

export function PixelHeartHuntRenderer({ data, mode }: RendererProps<PixelHeartHuntData>) {
  const [game, dispatch] = useReducer(reduce, undefined, initialGame);
  const engineRef = useRef<HeartHuntEngine | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [hasShot, setHasShot] = useState(false);
  const [sound] = useState(() => (typeof window === "undefined" ? null : createSound()));
  const soundRef = useRef(false);
  const fields = data as Record<string, string | undefined>;

  const palette = getPalette(data.palette);
  const letterFont = getFont(data.letter_font, "nunito");
  const title = data.game_title?.trim() || DEFAULT_TITLE;
  const memories: Memory[] = Array.from({ length: MEMORY_COUNT }, (_, i) => ({
    photo: fields[`memory_photo_${i + 1}`],
    caption: fields[`memory_caption_${i + 1}`]?.trim() ?? "",
  }));

  // Start downloading the photos during the intro so each one is ready when it unlocks.
  for (const m of memories) if (m.photo) preload(m.photo, { as: "image" });

  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);
  useEffect(() => () => sound?.close(), [sound]);

  const { phase } = game;
  const running = phase === "PLAYING" || phase === "ENDLESS";

  // Intro → game after a moment.
  useEffect(() => {
    if (phase !== "INTRO") return;
    const t = window.setTimeout(() => dispatch({ type: "start" }), INTRO_MS);
    return () => window.clearTimeout(t);
  }, [phase, game.run]);

  const onEvents = useCallback((events: GameEvent[]) => {
    for (const e of events) {
      if (e.type === "shot") {
        setHasShot(true);
        if (soundRef.current) sound?.shot();
      } else if (e.type === "hit") {
        if (soundRef.current) sound?.pop();
        dispatch({ type: "hit" });
      } else {
        dispatch({ type: "popped" });
      }
    }
  }, [sound]);

  // The jingle when a photo unlocks.
  useEffect(() => {
    if (phase === "MEMORY_REVEAL" && soundRef.current) sound?.unlock();
  }, [phase, game.unlocked, sound]);

  const closeMemory = useCallback(() => {
    engineRef.current?.unlock();
    dispatch({ type: "closeMemory" });
  }, []);

  const keepPlaying = useCallback(() => {
    const engine = engineRef.current;
    if (engine && engine.mode !== "endless") engine.startEndless();
    dispatch({ type: "keepPlaying" });
  }, []);

  const reset = useCallback(() => {
    setHasShot(false);
    dispatch({ type: "reset" });
  }, []);

  // Keyboard: ←/A and →/D aim, Space shoots, Esc closes. On the live page anywhere; in the
  // editor only while the preview has focus (so typing in the form never moves the bow).
  useEffect(() => {
    const ignore = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return true;
      const scroller = rootRef.current?.closest("[data-lw-scroll]");
      return Boolean(scroller && !scroller.contains(document.activeElement));
    };
    const aimKey = (key: string) => (key === "ArrowLeft" || key === "a" || key === "A" ? -1 : key === "ArrowRight" || key === "d" || key === "D" ? 1 : 0);
    const onDown = (e: KeyboardEvent) => {
      if (ignore(e)) return;
      if (e.key === "Escape") {
        if (phase === "MEMORY_REVEAL") closeMemory();
        else if (phase === "GALLERY" || phase === "CONFIRM_RESET") dispatch({ type: "back" });
        return;
      }
      if (!running) return;
      const engine = engineRef.current;
      if (!engine) return;
      const dir = aimKey(e.key);
      if (dir) {
        e.preventDefault();
        engine.aimDir = dir;
      } else if (e.key === " " || e.key === "Spacebar") {
        // A focused button handles Space itself (that's how keyboard users press them).
        if (e.target instanceof Element && e.target.closest("button")) return;
        e.preventDefault();
        // Fire at once (a quick tap may be shorter than a frame); holding keeps firing.
        if (!e.repeat && engine.shoot()) onEvents([{ type: "shot" }]);
        engine.shootHeld = true;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const dir = aimKey(e.key);
      if (dir && engine.aimDir === dir) engine.aimDir = 0;
      if (e.key === " " || e.key === "Spacebar") engine.shootHeld = false;
    };
    const release = () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.aimDir = 0;
      engine.shootHeld = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
    };
  }, [phase, running, closeMemory, onEvents]);

  /** Held-button input goes straight to the game (read every frame), not through React state. */
  const input = useCallback((patch: { aimDir?: number; shootHeld?: boolean }) => {
    const engine = engineRef.current;
    if (engine) Object.assign(engine, patch);
  }, []);
  const aimStep = useCallback((dir: number) => engineRef.current?.aimBy(dir * KEY_AIM_STEP), []);
  const shootOnce = useCallback(() => {
    if (engineRef.current?.shoot()) onEvents([{ type: "shot" }]);
  }, [onEvents]);

  const vars = {
    "--bg": palette.bg,
    "--bg-low": palette.bgLow,
    "--soft": palette.soft,
    "--heart": palette.heart,
    "--heart-dark": palette.heartDark,
    "--accent": palette.accent,
    "--cream": palette.cream,
    "--ink": palette.ink,
    "--paper-ink": palette.paperInk,
    "--letter-font": `var(${letterFont.cssVar})`,
  } as CSSProperties;

  const status =
    phase === "ENDLESS" ? `Hearts collected: ${game.score}` : game.collected > 0 ? `${game.collected} of ${MEMORY_COUNT} hearts collected` : "";

  return (
    <div ref={rootRef} className={s.root} style={vars}>
      <p className={s.srOnly} aria-live="polite">
        {status}
      </p>

      {/* ── Top: title, progress, memories, sound ── */}
      <header className={s.hud}>
        <div className={s.hudTitle}>
          <h1 className={s.title}>{title}</h1>
          {phase === "ENDLESS" ? (
            <p className={s.score}>
              Hearts Collected: <span>{game.score}</span>
            </p>
          ) : (
            <div className={s.progress} aria-label={`${game.collected} of ${MEMORY_COUNT} hearts`}>
              <span className={s.count}>
                {game.collected} / {MEMORY_COUNT}
              </span>
              <span className={s.pips} aria-hidden>
                {memories.map((_, i) => (
                  <Icon key={i} name="heart" className={i < game.collected ? s.pipOn : s.pip} />
                ))}
              </span>
            </div>
          )}
        </div>
        <div className={s.hudButtons}>
          {game.letterSeen && (
            <button type="button" className={s.iconBtn} onClick={() => dispatch({ type: "openLetter" })} disabled={!running} aria-label="Read the letter again">
              <Icon name="letter" />
            </button>
          )}
          <button
            type="button"
            className={s.iconBtn}
            onClick={() => dispatch({ type: "openGallery" })}
            disabled={game.unlocked === 0 || !(running || phase === "LETTER_UNLOCK")}
            aria-label={`Memories (${game.unlocked} unlocked)`}
          >
            <Icon name="photo" />
            {game.unlocked > 0 && <span className={s.badge}>{game.unlocked}</span>}
          </button>
          <button
            type="button"
            className={s.iconBtn}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Sound on" : "Sound off"}
            onClick={() => {
              if (!soundOn) sound?.wake();
              setSoundOn(!soundOn);
            }}
          >
            <Icon name={soundOn ? "soundOn" : "soundOff"} />
          </button>
        </div>
      </header>

      {/* ── The play area ── */}
      <div className={s.stage}>
        <GameCanvas key={game.run} engineRef={engineRef} running={running} palette={palette} aimGuide={running} onEvents={onEvents} />
        {phase === "PLAYING" && !hasShot && game.collected === 0 && (
          <p className={s.hint}>
            Aim, shoot, and collect {MEMORY_COUNT} little pieces of love!
            <span>Hold ◀ ▶ to aim and tap ♥ — or just tap where to shoot.</span>
          </p>
        )}
        {phase === "LETTER_UNLOCK" && (
          <EnvelopeReward onOpened={() => dispatch({ type: "openLetter" })} />
        )}
      </div>

      {/* ── Bottom: controls ── */}
      <nav className={s.controls} aria-label="Game controls">
        <button type="button" className={`${s.btn} ${s.small}`} onClick={() => dispatch({ type: "askReset" })} disabled={phase === "INTRO"} aria-label="Restart">
          <Icon name="restart" />
        </button>
        <HoldButton label="Aim left" disabled={!running} onStart={() => input({ aimDir: -1 })} onStop={() => input({ aimDir: 0 })} onKeyPress={() => aimStep(-1)}>
          <Icon name="left" />
        </HoldButton>
        <HoldButton
          label="Shoot"
          className={s.shoot}
          disabled={!running}
          onStart={() => {
            shootOnce();
            input({ shootHeld: true });
          }}
          onStop={() => input({ shootHeld: false })}
          onKeyPress={shootOnce}
        >
          <Icon name="heart" />
        </HoldButton>
        <HoldButton label="Aim right" disabled={!running} onStart={() => input({ aimDir: 1 })} onStop={() => input({ aimDir: 0 })} onKeyPress={() => aimStep(1)}>
          <Icon name="right" />
        </HoldButton>
        <span className={`${s.small} ${s.spacer}`} aria-hidden />
      </nav>

      {/* ── Overlays ── */}
      {phase === "INTRO" && <Intro text={data.intro_text?.trim() || DEFAULT_INTRO} name={data.recipient_name} onSkip={() => dispatch({ type: "start" })} />}

      {phase === "MEMORY_REVEAL" && game.openMemory !== null && (
        <MemoryCard
          key={game.openMemory}
          index={game.openMemory}
          memory={memories[game.openMemory]!}
          autoClose
          last={game.openMemory === MEMORY_COUNT - 1}
          onClose={closeMemory}
        />
      )}

      {phase === "GALLERY" &&
        (game.openMemory !== null ? (
          <MemoryCard index={game.openMemory} memory={memories[game.openMemory]!} onClose={() => dispatch({ type: "back" })} />
        ) : (
          <Gallery memories={memories} unlocked={game.unlocked} onOpen={(i) => dispatch({ type: "viewMemory", index: i })} onClose={() => dispatch({ type: "back" })} />
        ))}

      {phase === "LETTER_OPEN" && (
        <Letter
          greeting={data.letter_title?.trim() || DEFAULT_GREETING}
          message={data.letter_message ?? ""}
          signature={data.letter_signature?.trim() || DEFAULT_SIGNATURE}
          sender={data.sender_name}
          mode={mode}
          onKeepPlaying={keepPlaying}
        />
      )}

      {phase === "CONFIRM_RESET" && <ConfirmReset onConfirm={reset} onCancel={() => dispatch({ type: "back" })} returnTo={game.returnTo} />}
    </div>
  );
}

/* ─── A button you can hold ───────────────────────────────────────────────── */

/** Starts on press and stops on release, cancel or losing the pointer; Enter/Space press it once. */
function HoldButton({
  label,
  className,
  disabled,
  onStart,
  onStop,
  onKeyPress,
  children,
}: {
  label: string;
  className?: string;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
  onKeyPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${s.btn} ${className ?? ""}`}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Some browsers refuse capture (e.g. a pointer that already ended) — the press still counts.
        }
        onStart();
      }}
      onPointerUp={onStop}
      onPointerCancel={onStop}
      onLostPointerCapture={onStop}
      onContextMenu={(e) => e.preventDefault()}
      // Keyboard presses arrive as clicks with no pointer (detail 0); pointer presses were handled above.
      onClick={(e) => e.detail === 0 && onKeyPress()}
    >
      {children}
    </button>
  );
}

/* ─── Intro ──────────────────────────────────────────────────────────────── */

function Intro({ text, name, onSkip }: { text: string; name?: string; onSkip: () => void }) {
  return (
    <div className={s.intro}>
      <PixelArt bitmap={SEAL} colors={{ o: "var(--heart-dark)", h: "var(--heart)", w: "var(--cream)" }} className={s.introHeart} />
      <p className={s.introText}>{text}</p>
      {name && <p className={s.introName}>for {name}</p>}
      <button type="button" className={s.skip} onClick={onSkip}>
        Skip ▸
      </button>
    </div>
  );
}

/* ─── A photo that unlocked ──────────────────────────────────────────────── */

function Photo({ src, alt, className }: { src?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return (
      <div className={`${className ?? ""} ${s.photoMissing}`} role="img" aria-label="Photo unavailable">
        <PixelArt bitmap={SEAL} colors={{ o: "var(--heart-dark)", h: "var(--accent)", w: "var(--cream)" }} className={s.missingHeart} />
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onError={() => setFailed(src)} draggable={false} />;
}

function MemoryCard({
  index,
  memory,
  autoClose = false,
  last = false,
  onClose,
}: {
  index: number;
  memory: Memory;
  autoClose?: boolean;
  last?: boolean;
  onClose: () => void;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label={`Memory ${index + 1} unlocked`} onClick={onClose}>
      <figure className={`${s.box} ${s.memory}`} onClick={(e) => e.stopPropagation()} onPointerDown={() => setPaused(true)}>
        <p className={s.memoryTag}>
          {autoClose ? "Memory unlocked!" : "Memory"} · {index + 1} / {MEMORY_COUNT}
        </p>
        <Photo src={memory.photo} alt={`Memory ${index + 1}`} className={s.memoryPhoto} />
        {memory.caption && <figcaption className={s.caption}>{memory.caption}</figcaption>}
        <button type="button" className={`${s.btn} ${s.wide}`} onClick={onClose} autoFocus>
          {last && autoClose ? "One more thing… ♡" : "Continue ♡"}
        </button>
        {autoClose && !paused && <span className={s.timer} onAnimationEnd={onClose} style={{ animationDuration: `${REVEAL_AUTO_MS}ms` }} aria-hidden />}
      </figure>
    </div>
  );
}

function Gallery({ memories, unlocked, onOpen, onClose }: { memories: Memory[]; unlocked: number; onOpen: (i: number) => void; onClose: () => void }) {
  return (
    <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Memories" onClick={onClose}>
      <div className={`${s.box} ${s.gallery}`} onClick={(e) => e.stopPropagation()}>
        <div className={s.boxHead}>
          <h2>Memories</h2>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close" autoFocus>
            <Icon name="close" />
          </button>
        </div>
        <ul className={s.galleryGrid}>
          {memories.map((m, i) => (
            <li key={i}>
              {i < unlocked ? (
                <button type="button" className={s.galleryTile} onClick={() => onOpen(i)} aria-label={`Open memory ${i + 1}`}>
                  <Photo src={m.photo} alt="" className={s.galleryPhoto} />
                </button>
              ) : (
                <div className={`${s.galleryTile} ${s.locked}`} aria-label={`Memory ${i + 1} — still locked`}>
                  <Icon name="heart" />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── The envelope and the letter ────────────────────────────────────────── */

type EnvelopeStage = "waiting" | "opening" | "sliding";

function EnvelopeReward({ onOpened }: { onOpened: () => void }) {
  const [stage, setStage] = useState<EnvelopeStage>("waiting");
  const open = () => {
    if (stage !== "waiting") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onOpened();
    setStage("opening");
  };
  useEffect(() => {
    if (stage === "waiting") return;
    const t = window.setTimeout(() => (stage === "opening" ? setStage("sliding") : onOpened()), stage === "opening" ? 650 : 750);
    return () => window.clearTimeout(t);
  }, [stage, onOpened]);

  const colors = { o: "var(--heart-dark)", c: "var(--cream)", d: "var(--soft)", b: "var(--bg-low)", h: "var(--heart)", w: "var(--cream)" };
  return (
    <div className={s.reward} data-stage={stage}>
      <p className={s.rewardTitle}>You found all my love!</p>
      <button type="button" className={s.envelope} onClick={open} aria-label="Open the envelope" autoFocus>
        <span className={s.sparkles} aria-hidden>
          <i />
          <i />
          <i />
          <i />
        </span>
        <PixelArt bitmap={ENVELOPE_BACK} colors={colors} className={s.envBack} />
        <span className={s.envPaper} aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <PixelArt bitmap={ENVELOPE_FRONT} colors={colors} className={s.envFront} />
        <span className={s.envFlap}>
          <PixelArt bitmap={ENVELOPE_FLAP} colors={colors} className={s.envFlapArt} />
          <PixelArt bitmap={SEAL} colors={colors} className={s.envSeal} />
        </span>
      </button>
      <p className={s.rewardSub}>There&rsquo;s one last surprise for you...</p>
      <p className={s.rewardPrompt} aria-hidden>
        Click to open ♡
      </p>
    </div>
  );
}

function Letter({
  greeting,
  message,
  signature,
  sender,
  mode,
  onKeepPlaying,
}: {
  greeting: string;
  message: string;
  signature: string;
  sender: string;
  mode: "preview" | "live";
  onKeepPlaying: () => void;
}) {
  return (
    <div className={`${s.overlay} ${s.letterOverlay}`} role="dialog" aria-modal="true" aria-label="Your love letter">
      <article className={s.letter}>
        <span className={s.letterHearts} aria-hidden>
          <Icon name="heart" />
          <Icon name="heart" />
          <Icon name="heart" />
        </span>
        <h2 className={s.greeting}>{greeting}</h2>
        <div className={s.body}>{message}</div>
        <p className={s.signature}>
          {signature}
          <span>{sender}</span>
        </p>
        <button type="button" className={`${s.btn} ${s.wide}`} onClick={onKeepPlaying} autoFocus>
          Keep Playing ♡
        </button>
        <p className={s.madeWith}>
          Made with ♥ by Love, Written ·{" "}
          <Link href="/" target={mode === "preview" ? "_blank" : undefined} rel="noopener">
            Make one →
          </Link>
        </p>
      </article>
    </div>
  );
}

function ConfirmReset({ onConfirm, onCancel, returnTo }: { onConfirm: () => void; onCancel: () => void; returnTo: Phase | null }) {
  return (
    <div className={s.overlay} role="alertdialog" aria-modal="true" aria-labelledby="lw-phh-reset" onClick={onCancel}>
      <div className={`${s.box} ${s.confirm}`} onClick={(e) => e.stopPropagation()}>
        <h2 id="lw-phh-reset">Start over?</h2>
        <p>{returnTo === "ENDLESS" ? "Your hearts score and unlocked memories will reset." : "Your hearts and unlocked memories will reset."} The surprise starts again from the beginning.</p>
        <div className={s.confirmButtons}>
          <button type="button" className={`${s.btn} ${s.ghost}`} onClick={onCancel} autoFocus>
            Keep going
          </button>
          <button type="button" className={s.btn} onClick={onConfirm}>
            Start over
          </button>
        </div>
      </div>
    </div>
  );
}
