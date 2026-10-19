"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { boardSize, cellAt, cutLines, makePuzzle, shuffledOrder, snapRadius, type Piece, type Puzzle as PuzzleGeo } from "./geometry";
import { DragGesture, boardToClient, clientToBoard, clientToLocal, grabOffset, heldCorner, topLeftForScaled, type Pt, type Rect } from "./drag";
import type { Sound } from "./sound";
import s from "./pieces-of-us.module.css";

/**
 * One jigsaw puzzle: the board, the tray of mixed-up pieces, the reference photo, and the
 * drag / tap handling.
 *
 * Rendering: every piece is the same photo clipped by its own jigsaw outline (one image
 * download, reused — the reference photo included). Placed pieces are drawn as ONE image clipped
 * by the union of their outlines, so a finished 8 × 8 board is still a single image on screen.
 *
 * Dragging: a press on a tray piece becomes a drag as soon as it moves a few pixels (no delay),
 * in any direction. The floating copy first appears exactly over the tray piece, held at the
 * spot the finger or cursor touched, and grows to board size around that spot. It then follows
 * the pointer through the CSS `translate` property, at most once per frame — no React renders
 * while dragging. All positions come from fresh measurements (see drag.ts), so scrolling,
 * zooming, panning, resizing and rotating can't throw a piece somewhere else.
 */

/** How much a held piece grows to look "picked up" (it scales around the grab point). */
const LIFT_SCALE = 1.06;
const ZOOM_MAX = 2.6;
const WIDE_PX = 720; // same as the @container rule in the CSS

/** The floating piece: its full-size box in local px, where it's held, and how it first appears. */
type Lifted = {
  id: number;
  w: number;
  h: number;
  /** Grab point inside the full-size box (local px) — also the scale origin. */
  grab: Pt;
  /** Box top-left (local px) and scale for the very first paint, so it never flashes elsewhere. */
  at: Pt;
  scale: number;
};

export type PuzzleProps = {
  index: number;
  total: number;
  image: string;
  n: number;
  sound: Sound | null;
  soundOn: boolean;
  canShowMemories: boolean;
  onToggleSound: () => void;
  onRestart: () => void;
  onMemories: () => void;
  onSolved: () => void;
};

export function Puzzle(props: PuzzleProps) {
  const aspect = useImageAspect(props.image);
  if (aspect === null) {
    return (
      <div className={s.puzzleLoading} role="status">
        <span className={s.spinner} aria-hidden />
        Unpacking the pieces…
      </div>
    );
  }
  return <Board {...props} aspect={aspect} />;
}

function Board({ index, total, image, n, sound, soundOn, canShowMemories, onToggleSound, onRestart, onMemories, onSolved, aspect }: PuzzleProps & { aspect: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const puzzle = useMemo(() => {
    const { w, h } = boardSize(aspect);
    return makePuzzle(n, w, h, seed);
  }, [aspect, n, seed]);
  const order = useMemo(() => shuffledOrder(n * n, seed), [n, seed]);
  const lines = useMemo(() => cutLines(puzzle), [puzzle]);

  const [placed, setPlaced] = useState<ReadonlySet<number>>(() => new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [lifted, setLifted] = useState<Lifted | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const [hint, setHint] = useState<number | null>(null);
  const [settled, setSettled] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [sparkles, setSparkles] = useState<{ key: number; x: number; y: number }[]>([]);
  const [wide, setWide] = useState(false);
  const solved = placed.size === n * n;

  const playRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<SVGGElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const view = useRef({ zoom: 1, x: 0, y: 0 });
  const gesture = useRef(new DragGesture());
  /** The drag in progress: grab offset and knob room in client px (full size), and client px per local px. */
  const held = useRef<{ grab: Pt; pad: number; k: number; boxW: number } | null>(null);
  const frame = useRef(0);
  const timers = useRef<number[]>([]);
  const reduced = useRef(false);
  const latest = useRef({ placed, selected, solved, soundOn });
  useEffect(() => {
    latest.current = { placed, selected, solved, soundOn };
  });

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    const list = timers.current;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  // Phone (tray strip below) or wide (tray beside the board).
  useEffect(() => {
    const el = playRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWide(el.offsetWidth >= WIDE_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Coordinates: always measured fresh (never cached) — see drag.ts ──
  const geo = useCallback(() => {
    const r: Rect = svgRef.current!.getBoundingClientRect();
    const v = { ...view.current };
    return {
      scale: (r.width / puzzle.w) * v.zoom, // client px per board unit
      toBoard: (p: Pt) => clientToBoard(p, r, puzzle.w, v),
      toScreen: (p: Pt) => boardToClient(p, r, puzzle.w, v),
    };
  }, [puzzle.w]);

  /** Client → the play area's own CSS pixels (the editor preview shrinks it with a transform). */
  const toLocal = useCallback((p: Pt): Pt & { k: number } => {
    const el = playRef.current!;
    const r = el.getBoundingClientRect();
    return { ...clientToLocal(p, r, el.offsetWidth), k: r.width / el.offsetWidth || 1 };
  }, []);

  const applyView = () => {
    const v = view.current;
    zoomRef.current?.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.zoom})`);
  };
  const setZoom = (zoom: number, about?: Pt) => {
    const v = view.current;
    const z = Math.min(ZOOM_MAX, Math.max(1, zoom));
    const c = about ?? { x: puzzle.w / 2, y: puzzle.h / 2 }; // in un-zoomed board units
    // Keep the point under `about` where it is while zooming.
    const bx = (c.x - v.x) / v.zoom;
    const by = (c.y - v.y) / v.zoom;
    v.zoom = z;
    v.x = clamp(c.x - bx * z, puzzle.w - puzzle.w * z, 0);
    v.y = clamp(c.y - by * z, puzzle.h - puzzle.h * z, 0);
    applyView();
  };

  // ── Placing ──
  const place = useCallback(
    (id: number) => {
      if (latest.current.placed.has(id)) return;
      setPlaced((prev) => new Set(prev).add(id));
      setSelected((sel) => (sel === id ? null : sel));
      setHint(null);
      setSettled(id);
      later(() => setSettled((cur) => (cur === id ? null : cur)), 520);
      if (latest.current.soundOn) sound?.click();
      // A tiny burst of hearts where it landed (a few at most on screen).
      const piece = puzzle.pieces[id]!;
      const c = geo().toScreen({ x: piece.x + puzzle.cellW / 2, y: piece.y + puzzle.cellH / 2 });
      const local = toLocal(c);
      const key = Date.now() + id;
      setSparkles((list) => [...list.slice(-2), { key, x: local.x, y: local.y }]);
      later(() => setSparkles((list) => list.filter((sp) => sp.key !== key)), 700);
    },
    [geo, later, puzzle, sound, toLocal],
  );

  // Finished: seams fade, the whole photo shows, then the memory.
  useEffect(() => {
    if (!solved) return;
    if (latest.current.soundOn) sound?.chime();
    const t = window.setTimeout(onSolved, reduced.current ? 600 : 1500);
    return () => window.clearTimeout(t);
  }, [solved, onSolved, sound]);

  // ── The floating piece ──
  const setGhost = (at: Pt, scale?: number) => {
    const el = ghostRef.current;
    if (!el) return;
    el.style.translate = `${at.x}px ${at.y}px`;
    if (scale !== undefined) el.style.scale = String(scale);
  };

  /** Animate the floating piece's box to a position / scale; resolves even if the page isn't drawing. */
  const flyGhost = (at: Pt, scale: number, ms: number) => {
    const el = ghostRef.current;
    if (!el) return Promise.resolve();
    const from = { translate: el.style.translate || "0px 0px", scale: el.style.scale || "1" };
    const to = { translate: `${at.x}px ${at.y}px`, scale: String(scale) };
    el.style.transition = "none";
    if (reduced.current || !el.animate) {
      setGhost(at, scale);
      return Promise.resolve();
    }
    const anim = el.animate([from, to], { duration: ms, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    const timeout = new Promise<void>((done) => window.setTimeout(done, ms + 120));
    return Promise.race([anim.finished.then(() => undefined, () => undefined), timeout]).then(() => {
      setGhost(at, scale);
      anim.cancel();
    });
  };

  const trayButton = (id: number) => trayRef.current?.querySelector<HTMLElement>(`[data-piece="${id}"]`) ?? null;

  /** Lift a piece out of its tray button: drawn exactly over the button, held at `pointer` (client px). */
  const liftFrom = (id: number, pointer: Pt) => {
    const btn = trayButton(id);
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    const g = geo();
    const local = toLocal(pointer);
    const k = local.k;
    const boxW = (puzzle.cellW + puzzle.pad * 2) * g.scale; // full-size box, client px
    const boxH = (puzzle.cellH + puzzle.pad * 2) * g.scale;
    const grab = grabOffset(pointer, r, boxW);
    held.current = { grab, pad: puzzle.pad * g.scale, k, boxW };
    const grabLocal = { x: grab.x / k, y: grab.y / k };
    setLifted({ id, w: boxW / k, h: boxH / k, grab: grabLocal, at: { x: local.x - grabLocal.x, y: local.y - grabLocal.y }, scale: r.width / boxW });
    return true;
  };

  // Right after the floating piece first paints (exactly over its tray button), grow it to board size.
  useLayoutEffect(() => {
    const el = ghostRef.current;
    if (!lifted || !el || !gesture.current.dragging) return;
    el.style.transition = reduced.current ? "none" : "scale .14s ease-out";
    const raf = requestAnimationFrame(() => {
      el.style.scale = String(LIFT_SCALE);
    });
    return () => cancelAnimationFrame(raf);
  }, [lifted]);

  const moveToPointer = () => {
    const h = held.current;
    if (!h || !gesture.current.dragging) return;
    const local = toLocal(gesture.current.last);
    setGhost({ x: local.x - h.grab.x / h.k, y: local.y - h.grab.y / h.k });
  };
  /**
   * Follow the pointer — at most once per frame. If the browser is holding frames back
   * (power saving, a busy page), don't let the piece freeze: after 100 ms move it anyway.
   */
  const frameAsked = useRef(0);
  const follow = () => {
    if (frame.current) {
      if (performance.now() - frameAsked.current > 100) {
        frameAsked.current = performance.now();
        moveToPointer();
      }
      return;
    }
    frameAsked.current = performance.now();
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      moveToPointer();
    });
  };
  const stopFollowing = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  };

  /** Send a lifted piece home into its tray button. */
  const returnToTray = async (id: number) => {
    const btn = trayButton(id);
    const h = held.current;
    if (btn && h) {
      const r = btn.getBoundingClientRect();
      const local = toLocal({ x: r.left, y: r.top });
      const scale = r.width / h.boxW;
      await flyGhost(topLeftForScaled(local, { x: h.grab.x / h.k, y: h.grab.y / h.k }, scale), scale, 220);
    }
    held.current = null;
    setLifted(null);
  };

  /** Fly a lifted piece into its exact spot on the board, then lock it there. */
  const snapInto = async (id: number) => {
    const h = held.current;
    if (h) {
      const piece = puzzle.pieces[id]!;
      const corner = toLocal(geo().toScreen({ x: piece.x, y: piece.y }));
      const box = { x: corner.x - h.pad / h.k, y: corner.y - h.pad / h.k };
      await flyGhost(topLeftForScaled(box, { x: h.grab.x / h.k, y: h.grab.y / h.k }, 1), 1, 140);
    }
    place(id);
    held.current = null;
    setLifted(null);
  };

  /** Finish a drag: snap if the piece is near its spot, otherwise send it home. No pointer = send it home. */
  const endDrag = (id: number, pointer: Pt | null, touch: boolean) => {
    stopFollowing();
    const h = held.current;
    if (!h || !pointer) return void returnToTray(id);
    const g = geo();
    const corner = g.toBoard(heldCorner(pointer, h.grab, h.pad, LIFT_SCALE));
    const piece = puzzle.pieces[id]!;
    const near = Math.hypot(corner.x - piece.x, corner.y - piece.y) <= snapRadius(puzzle, g.scale, touch);
    void (near ? snapInto(id) : returnToTray(id));
  };

  // ── Tray: tap to select, drag (any direction) to move ──
  const onTrayDown = (e: ReactPointerEvent<HTMLButtonElement>, id: number) => {
    const g = gesture.current;
    // A piece still flying home or into place finishes first (a fraction of a second).
    if (latest.current.solved || e.button > 0 || refOpen || (lifted && !g.active)) return;
    if (g.active && g.dragging) {
      // The last drag never got its release (lost pointer): drop that floating piece right away.
      stopFollowing();
      held.current = null;
      setLifted(null);
    }
    g.down(e.pointerId, id, e.pointerType, { x: e.clientX, y: e.clientY });
    capture(e.currentTarget, e.pointerId);
  };

  // Window listeners are attached once and call the latest handlers through a ref (no stale closures).
  const handlers = useRef({ move: (e: PointerEvent) => void e, up: (e: PointerEvent) => void e, cancel: (e: PointerEvent) => void e });
  useEffect(() => {
    handlers.current = {
      move: (e) => {
        const g = gesture.current;
        const id = g.pieceId;
        const result = g.move(e.pointerId, { x: e.clientX, y: e.clientY });
        if (id === null || result === "ignore" || result === "pending") return;
        if (result === "start") {
          // Lift it from where the press began, so the piece doesn't lag behind the slop distance.
          if (!liftFrom(id, g.start)) return void g.cancel();
          setSelected(null);
          if (latest.current.soundOn) sound?.wake();
        }
        if (e.cancelable) e.preventDefault();
        follow();
      },
      up: (e) => {
        const g = gesture.current;
        const id = g.pieceId;
        const touch = g.pointerType !== "mouse";
        const result = g.up(e.pointerId, { x: e.clientX, y: e.clientY });
        if (id === null) return;
        if (result === "tap") setSelected((sel) => (sel === id ? null : id));
        else if (result === "drop") endDrag(id, { x: e.clientX, y: e.clientY }, touch);
      },
      cancel: (e) => {
        const g = gesture.current;
        const id = g.pieceId;
        if (g.cancel(e.pointerId) === "cancel-drag" && id !== null) endDrag(id, null, false);
      },
    };
  });
  useEffect(() => {
    const move = (e: PointerEvent) => handlers.current.move(e);
    const up = (e: PointerEvent) => handlers.current.up(e);
    const cancel = (e: PointerEvent) => handlers.current.cancel(e);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    const pending = frame;
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      cancelAnimationFrame(pending.current);
    };
  }, []);

  // ── Reference photo ──
  const openReference = () => {
    // Opening it mid-drag (keyboard, a second finger) safely sends the held piece home first.
    const g = gesture.current;
    const id = g.pieceId;
    if (g.cancel() === "cancel-drag" && id !== null) endDrag(id, null, false);
    setRefOpen(true);
  };
  useEffect(() => {
    if (!refOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRefOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refOpen]);

  // ── Board: tap a spot for the selected piece; pinch / drag to zoom and pan (7 × 7 and up) ──
  const zoomable = n >= 7;
  const pointers = useRef(new Map<number, Pt>());
  const boardGesture = useRef<{ moved: boolean; pinch: { dist: number; zoom: number } | null; start: Pt } | null>(null);

  const onBoardDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (gesture.current.dragging) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    capture(e.currentTarget, e.pointerId);
    if (pointers.current.size === 1) boardGesture.current = { moved: false, pinch: null, start: { x: e.clientX, y: e.clientY } };
    else if (pointers.current.size === 2 && zoomable && boardGesture.current) {
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      boardGesture.current.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.current.zoom };
      boardGesture.current.moved = true;
    }
  };
  const onBoardMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    const g = boardGesture.current;
    if (!prev || !g) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (g.pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      const r = svgRef.current!.getBoundingClientRect();
      const k = r.width / puzzle.w;
      const mid = { x: ((a.x + b.x) / 2 - r.left) / k, y: ((a.y + b.y) / 2 - r.top) / k };
      setZoom((g.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / g.pinch.dist, mid);
      return;
    }
    if (!g.moved && Math.hypot(now.x - g.start.x, now.y - g.start.y) > 6) g.moved = true;
    if (g.moved && view.current.zoom > 1) {
      const r = svgRef.current!.getBoundingClientRect();
      const k = r.width / puzzle.w;
      const v = view.current;
      v.x = clamp(v.x + (now.x - prev.x) / k, puzzle.w - puzzle.w * v.zoom, 0);
      v.y = clamp(v.y + (now.y - prev.y) / k, puzzle.h - puzzle.h * v.zoom, 0);
      applyView();
    }
  };
  const onBoardUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    const g = boardGesture.current;
    if (pointers.current.size > 0) return;
    boardGesture.current = null;
    if (!g || g.moved || e.type === "pointercancel") return;
    const p = geo().toBoard({ x: e.clientX, y: e.clientY });
    tryPlaceAt(cellAt(puzzle, p.x, p.y));
  };

  /** Tap-to-place / keyboard: put the selected piece in a cell — only if it's its own cell. */
  const tryPlaceAt = (cell: number | null) => {
    const id = latest.current.selected;
    if (id === null || cell === null || latest.current.placed.has(cell) || lifted) return;
    if (cell !== id) {
      // Not its spot: a little shake, the piece stays selected.
      if (!reduced.current) svgRef.current?.animate?.([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 260 });
      return;
    }
    const btn = trayButton(id);
    if (!btn || reduced.current) return place(id);
    // Fly the piece from its tray button (held by its middle) to its spot.
    const r = btn.getBoundingClientRect();
    if (!liftFrom(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 })) return place(id);
    later(() => void snapInto(id), 30);
  };

  const onBoardKey = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      const cur = cursor ?? 0;
      const col = clamp((cur % n) + m[0], 0, n - 1);
      const row = clamp(Math.floor(cur / n) + m[1], 0, n - 1);
      setCursor(row * n + col);
    } else if ((e.key === "Enter" || e.key === " ") && cursor !== null) {
      e.preventDefault();
      tryPlaceAt(cursor);
    } else if (e.key === "Escape") setSelected(null);
  };

  // ── Hint: show where the selected piece goes (or pick one and show it) ──
  const showHint = () => {
    let id = latest.current.selected;
    if (id === null) {
      id = order.find((p) => !latest.current.placed.has(p)) ?? null;
      if (id === null) return;
      setSelected(id);
      trayButton(id)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced.current ? "auto" : "smooth" });
    }
    setHint(id);
    const shown = id;
    later(() => setHint((h) => (h === shown ? null : h)), 1800);
  };

  /** Tray arrows: scroll the tray by most of a screenful (swiping between pieces works too). */
  const scrollTray = (dir: 1 | -1) => {
    const t = trayRef.current;
    if (!t) return;
    const smooth = reduced.current ? "auto" : "smooth";
    if (wide) t.scrollBy({ top: dir * t.clientHeight * 0.8, behavior: smooth });
    else t.scrollBy({ left: dir * t.clientWidth * 0.8, behavior: smooth });
  };

  const remaining = order.filter((id) => !placed.has(id));
  const placedPaths = useMemo(() => [...placed].map((id) => puzzle.pieces[id]!.path), [placed, puzzle]);
  const imgProps = { href: image, x: 0, y: 0, width: puzzle.w, height: puzzle.h, preserveAspectRatio: "xMidYMid slice" } as const;
  const liftedPiece = lifted ? puzzle.pieces[lifted.id]! : null;
  /** The photo exactly as the puzzle cuts it (same crop, same image). */
  const reference = (
    <svg viewBox={`0 0 ${puzzle.w} ${puzzle.h}`} className={s.refImage} aria-hidden>
      <image {...imgProps} />
    </svg>
  );

  return (
    <div className={s.puzzle}>
      <div className={s.toolbar}>
        <button type="button" className={s.refMini} onClick={openReference} aria-label="See the whole photo (your little clue)">
          {reference}
        </button>
        <div className={s.toolbarInfo}>
          <p className={s.memoryNo}>
            Memory {index + 1} <span>of {total}</span>
          </p>
          <p className={s.counter} aria-live="polite">
            {placed.size} / {n * n} pieces
          </p>
        </div>
        <div className={s.toolButtons}>
          <button type="button" className={s.tool} onClick={showHint} disabled={solved} aria-label="Hint">
            <ToolIcon name="hint" /> <span className={s.toolLabel}>Hint</span>
          </button>
          <button type="button" className={s.tool} onClick={onToggleSound} aria-pressed={soundOn} aria-label={soundOn ? "Sound on" : "Sound off"}>
            <ToolIcon name={soundOn ? "soundOn" : "soundOff"} />
          </button>
          <button type="button" className={s.tool} onClick={onRestart} disabled={placed.size === 0 || solved} aria-label="Restart this puzzle">
            <ToolIcon name="restart" />
          </button>
          {canShowMemories && (
            <button type="button" className={s.tool} onClick={onMemories} aria-label="Our memories so far">
              <ToolIcon name="photos" />
            </button>
          )}
        </div>
      </div>

      <div ref={playRef} className={s.play} data-wide={wide || undefined}>
        <div className={s.boardArea}>
          <div className={`${s.boardWrap} ${solved ? s.solved : ""}`} style={{ "--ratio": `${puzzle.w} / ${puzzle.h}` } as CSSProperties}>
            <svg
              ref={svgRef}
              className={s.board}
              viewBox={`0 0 ${puzzle.w} ${puzzle.h}`}
              role="application"
              aria-label={`Puzzle board, ${n} by ${n}. ${selected !== null ? "A piece is selected: use the arrow keys and Enter to place it." : "Select a piece from the tray first."}`}
              tabIndex={0}
              style={{ touchAction: zoomable ? "none" : "manipulation" }}
              onPointerDown={onBoardDown}
              onPointerMove={onBoardMove}
              onPointerUp={onBoardUp}
              onPointerCancel={onBoardUp}
              onKeyDown={onBoardKey}
              onFocus={() => setCursor((c) => c ?? 0)}
              onBlur={() => setCursor(null)}
            >
              <defs>
                <clipPath id={`${uid}-placed`}>
                  {placedPaths.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </clipPath>
              </defs>
              <g ref={zoomRef}>
                <rect className={s.boardPaper} width={puzzle.w} height={puzzle.h} />
                <path className={s.slots} d={lines} />
                <image {...imgProps} clipPath={`url(#${uid}-placed)`} />
                {placedPaths.length > 0 && <path className={s.seams} d={placedPaths.join("")} />}
                {settled !== null && <path key={settled} className={s.settle} d={puzzle.pieces[settled]!.path} />}
                {hint !== null && !placed.has(hint) && <path key={`h${hint}`} className={s.hintSlot} d={puzzle.pieces[hint]!.path} />}
                {cursor !== null && <path className={s.cursor} d={puzzle.pieces[cursor]!.path} />}
                {solved && <image {...imgProps} className={s.reveal} />}
              </g>
            </svg>
          </div>
          {zoomable && (
            <div className={s.zoom}>
              <button type="button" onClick={() => setZoom(view.current.zoom * 1.4)} aria-label="Zoom in">
                +
              </button>
              <button type="button" onClick={() => setZoom(view.current.zoom / 1.4)} aria-label="Zoom out">
                −
              </button>
            </div>
          )}
        </div>

        <div className={s.side}>
          {/* Wide screens: the clue sits above the tray, beside the board (never over it). */}
          <button type="button" className={s.refCard} onClick={openReference} aria-label="See the whole photo (your little clue)">
            <span className={s.refTape} aria-hidden />
            {reference}
            <span className={s.refLabel}>Your little clue ♡</span>
          </button>
          <div className={s.trayWrap}>
            <button type="button" className={`${s.trayArrow} ${s.trayPrev}`} onClick={() => scrollTray(-1)} aria-label="Scroll pieces back" tabIndex={-1}>
              {wide ? "︿" : "‹"}
            </button>
            <div ref={trayRef} className={s.tray} role="listbox" aria-label="Puzzle pieces">
              {remaining.map((id) => (
                <TrayPiece
                  key={id}
                  piece={puzzle.pieces[id]!}
                  puzzle={puzzle}
                  image={image}
                  clipId={`${uid}-t${id}`}
                  selected={selected === id}
                  hidden={lifted?.id === id}
                  onPointerDown={onTrayDown}
                  onKeySelect={(pid) => setSelected((sel) => (sel === pid ? null : pid))}
                />
              ))}
              {remaining.length === 0 && <p className={s.trayDone}>All pieces placed ♡</p>}
            </div>
            <button type="button" className={`${s.trayArrow} ${s.trayNext}`} onClick={() => scrollTray(1)} aria-label="Scroll pieces forward" tabIndex={-1}>
              {wide ? "﹀" : "›"}
            </button>
          </div>
        </div>

        {/* Always laid out (hidden when nothing is selected), so the board never shifts mid-drag. */}
        <p className={s.selectedHint} style={selected !== null && !solved ? undefined : { visibility: "hidden" }} aria-hidden={selected === null || solved}>
          Now tap its spot on the board ·{" "}
          <button type="button" onClick={() => setSelected(null)} tabIndex={selected === null ? -1 : undefined}>
            Cancel
          </button>
        </p>

        {liftedPiece && lifted && (
          <div
            ref={ghostRef}
            className={s.ghost}
            style={{
              width: lifted.w,
              height: lifted.h,
              transformOrigin: `${lifted.grab.x}px ${lifted.grab.y}px`,
              translate: `${lifted.at.x}px ${lifted.at.y}px`,
              scale: String(lifted.scale),
            }}
            aria-hidden
          >
            <svg viewBox={`${liftedPiece.x - puzzle.pad} ${liftedPiece.y - puzzle.pad} ${puzzle.cellW + puzzle.pad * 2} ${puzzle.cellH + puzzle.pad * 2}`} width="100%" height="100%">
              <defs>
                <clipPath id={`${uid}-ghost`}>
                  <path d={liftedPiece.path} />
                </clipPath>
              </defs>
              <path d={liftedPiece.path} className={s.pieceShadow} />
              <image {...imgProps} clipPath={`url(#${uid}-ghost)`} />
              <path d={liftedPiece.path} className={s.pieceEdge} />
            </svg>
          </div>
        )}

        {sparkles.map((sp) => (
          <span key={sp.key} className={s.sparkle} style={{ left: sp.x, top: sp.y }} aria-hidden>
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        ))}
      </div>

      {refOpen && (
        <div className={s.refOverlay} role="dialog" aria-modal="true" aria-label="Your little clue: the whole photo" onClick={() => setRefOpen(false)}>
          <figure className={s.refBig} onClick={(e) => e.stopPropagation()} style={{ "--ratio": `${puzzle.w} / ${puzzle.h}` } as CSSProperties}>
            <span className={s.refTape} aria-hidden />
            {reference}
            <figcaption className={s.refLabel}>Your little clue ♡</figcaption>
          </figure>
          <button type="button" className={s.refClose} onClick={() => setRefOpen(false)} autoFocus>
            Close ✕
          </button>
        </div>
      )}
    </div>
  );
}

/** One piece in the tray. Memoized: picking up or placing one piece doesn't redraw the others. */
const TrayPiece = memo(function TrayPiece({
  piece,
  puzzle,
  image,
  clipId,
  selected,
  hidden,
  onPointerDown,
  onKeySelect,
}: {
  piece: Piece;
  puzzle: PuzzleGeo;
  image: string;
  clipId: string;
  selected: boolean;
  hidden: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>, id: number) => void;
  onKeySelect: (id: number) => void;
}) {
  const { pad, cellW, cellH } = puzzle;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={`Piece ${piece.id + 1}`}
      data-piece={piece.id}
      className={`${s.trayPiece} ${selected ? s.trayPieceOn : ""}`}
      style={{ visibility: hidden ? "hidden" : undefined, aspectRatio: `${cellW + pad * 2} / ${cellH + pad * 2}` }}
      onPointerDown={(e) => onPointerDown(e, piece.id)}
      onClick={(e) => e.detail === 0 && onKeySelect(piece.id)}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <svg viewBox={`${piece.x - pad} ${piece.y - pad} ${cellW + pad * 2} ${cellH + pad * 2}`} width="100%" height="100%" aria-hidden>
        <defs>
          <clipPath id={clipId}>
            <path d={piece.path} />
          </clipPath>
        </defs>
        <image href={image} x={0} y={0} width={puzzle.w} height={puzzle.h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
        <path d={piece.path} className={s.pieceEdge} />
      </svg>
    </button>
  );
});

function ToolIcon({ name }: { name: "hint" | "soundOn" | "soundOff" | "restart" | "photos" }) {
  const d = {
    hint: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z",
    soundOn: "M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
    soundOff: "M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6",
    restart: "M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5",
    photos: "M4 7h3l2-2h6l2 2h3v12H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  }[name];
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** Natural width ÷ height of an image (null while loading; 1 if it can't be read). */
function useImageAspect(src: string): number | null {
  const [state, setState] = useState<{ src: string; aspect: number } | null>(null);
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => live && setState({ src, aspect: img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1 });
    img.onerror = () => live && setState({ src, aspect: 1 });
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);
  return state?.src === src ? state.aspect : null;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Keep getting a pointer's events even when it leaves the element (some browsers refuse; that's fine). */
function capture(el: Element, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // e.g. the pointer already ended
  }
}
