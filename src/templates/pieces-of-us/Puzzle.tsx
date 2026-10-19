"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { boardSize, cellAt, cutLines, makePuzzle, shuffledOrder, snapRadius, type Piece, type Puzzle as PuzzleGeo } from "./geometry";
import type { Sound } from "./sound";
import s from "./pieces-of-us.module.css";

/**
 * One jigsaw puzzle: the board, the tray of mixed-up pieces, and the drag / tap handling.
 *
 * Rendering: every piece is the same photo clipped by its own jigsaw outline (one image
 * download, reused). Placed pieces are drawn as ONE image clipped by the union of their
 * outlines, so a finished 8 × 8 board is still a single image on screen.
 *
 * Dragging never re-renders React: the floating piece is moved by writing its transform
 * directly. React only updates when a piece is picked up, placed, or returned.
 */

const LIFT_PX = 18;
const ZOOM_MAX = 2.6;
const WIDE_PX = 720; // same as the @container rule in the CSS

type Pt = { x: number; y: number };
type Drag = {
  id: number;
  pointerId: number;
  touch: boolean;
  start: Pt;
  last: Pt;
  /** Pointer position minus the piece's top-left corner, in screen px. */
  grab: Pt;
  dragging: boolean;
  /** Where the piece came from (a tray button), to fly back to. */
  from: HTMLElement;
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
  /** The piece floating above the board, and its size in the play area's CSS px. */
  const [lifted, setLifted] = useState<{ id: number; w: number; h: number } | null>(null);
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
  const drag = useRef<Drag | null>(null);
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

  // Phone (tray strip below) or wide (tray beside the board) — decides how a tray swipe is read.
  useEffect(() => {
    const el = playRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWide(el.offsetWidth >= WIDE_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Coordinates: screen ↔ board (works with zoom, pan, and a scaled preview frame) ──
  const geo = useCallback(() => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = view.current;
    const k = r.width / puzzle.w; // screen px per board unit, before zoom
    return {
      scale: k * v.zoom,
      toBoard: (p: Pt): Pt => ({ x: ((p.x - r.left) / k - v.x) / v.zoom, y: ((p.y - r.top) / k - v.y) / v.zoom }),
      toScreen: (p: Pt): Pt => ({ x: r.left + (p.x * v.zoom + v.x) * k, y: r.top + (p.y * v.zoom + v.y) * k }),
    };
  }, [puzzle.w]);

  /** Screen → the play area's own CSS pixels (the preview frame may be scaled). */
  const toLocal = useCallback((p: Pt): Pt & { k: number } => {
    const el = playRef.current!;
    const r = el.getBoundingClientRect();
    const k = r.width / el.offsetWidth || 1;
    return { x: (p.x - r.left) / k, y: (p.y - r.top) / k, k };
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
  /** Lift a piece: the floating copy is drawn at the board's current on-screen size. */
  const lift = (id: number) => {
    const scale = geo().scale;
    const k = toLocal({ x: 0, y: 0 }).k;
    setLifted({ id, w: ((puzzle.cellW + puzzle.pad * 2) * scale) / k, h: ((puzzle.cellH + puzzle.pad * 2) * scale) / k });
  };
  /** Put the floating piece's top-left corner (the cell corner, not the knob) at a screen point. */
  const moveGhost = (corner: Pt) => {
    const el = ghostRef.current;
    if (!el) return;
    const { x, y, k } = toLocal(corner);
    const pad = (puzzle.pad * geo().scale) / k;
    el.style.transform = `translate(${x - pad}px, ${y - pad}px)`;
  };

  const flyGhost = (to: Pt, scaleTo: number, ms: number) => {
    const el = ghostRef.current;
    if (!el) return Promise.resolve();
    const { x, y, k } = toLocal(to);
    const pad = (puzzle.pad * geo().scale) / k;
    const target = `translate(${x - pad * scaleTo}px, ${y - pad * scaleTo}px) scale(${scaleTo})`;
    if (reduced.current || !el.animate) {
      el.style.transform = target;
      return Promise.resolve();
    }
    const anim = el.animate([{ transform: el.style.transform }, { transform: target }], { duration: ms, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    // A page that isn't being drawn (background tab) may never finish the animation: don't wait forever.
    const timeout = new Promise<void>((done) => window.setTimeout(done, ms + 120));
    return Promise.race([anim.finished.then(() => undefined, () => undefined), timeout]).then(() => {
      el.style.transform = target;
      anim.cancel();
    });
  };

  const trayButton = (id: number) => trayRef.current?.querySelector<HTMLElement>(`[data-piece="${id}"]`) ?? null;

  /** Send a lifted piece home to the tray. */
  const returnToTray = async (id: number) => {
    const btn = trayButton(id);
    if (btn) {
      const r = btn.getBoundingClientRect();
      const g = geo();
      const full = (puzzle.cellW + puzzle.pad * 2) * g.scale;
      const k = r.width / full;
      // The tray button shows the whole piece (with its knob room), so line up the corners.
      await flyGhost({ x: r.left + puzzle.pad * g.scale * k, y: r.top + puzzle.pad * g.scale * k }, k, 220);
    }
    setLifted(null);
  };

  const snapInto = async (id: number) => {
    const piece = puzzle.pieces[id]!;
    await flyGhost(geo().toScreen({ x: piece.x, y: piece.y }), 1, 140);
    place(id);
    setLifted(null);
  };

  // ── Tray: tap to select, pull out to drag ──
  const onTrayDown = (e: ReactPointerEvent<HTMLButtonElement>, id: number) => {
    if (latest.current.solved || drag.current || e.button > 0) return;
    const g = geo();
    const touch = e.pointerType === "touch";
    // Hold the piece by its middle — on touch a little above the finger so it stays visible.
    const grab = {
      x: (puzzle.cellW / 2) * g.scale,
      y: (puzzle.cellH / 2) * g.scale + (touch ? (puzzle.cellH / 2) * g.scale + LIFT_PX : 0),
    };
    drag.current = { id, pointerId: e.pointerId, touch, start: { x: e.clientX, y: e.clientY }, last: { x: e.clientX, y: e.clientY }, grab, dragging: false, from: e.currentTarget };
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      d.last = { x: e.clientX, y: e.clientY };
      if (!d.dragging) {
        const dx = Math.abs(e.clientX - d.start.x);
        const dy = Math.abs(e.clientY - d.start.y);
        // Touch: a swipe along the tray scrolls it; pulling a piece out of the tray lifts it.
        const pulled = d.touch ? (wide ? dx > 8 && dx > dy : dy > 8 && dy > dx) : Math.hypot(dx, dy) > 5;
        if (!pulled) return;
        d.dragging = true;
        lift(d.id);
        setSelected(null);
        if (latest.current.soundOn) sound?.wake();
      }
      e.preventDefault();
      moveGhost({ x: e.clientX - d.grab.x, y: e.clientY - d.grab.y });
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      drag.current = null;
      if (!d.dragging) {
        // A tap: select (or unselect) this piece.
        setSelected((sel) => (sel === d.id ? null : d.id));
        return;
      }
      const g = geo();
      const corner = g.toBoard({ x: d.last.x - d.grab.x, y: d.last.y - d.grab.y });
      const piece = puzzle.pieces[d.id]!;
      const near = Math.hypot(corner.x - piece.x, corner.y - piece.y) <= snapRadius(puzzle, g.scale, d.touch);
      void (near ? snapInto(d.id) : returnToTray(d.id));
    };
    const cancel = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      drag.current = null;
      if (d.dragging) void returnToTray(d.id);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  });

  // Once the floating piece exists, put it under the finger right away.
  useEffect(() => {
    const d = drag.current;
    if (lifted && d?.dragging) moveGhost({ x: d.last.x - d.grab.x, y: d.last.y - d.grab.y });
  });

  // ── Board: tap a spot for the selected piece; pinch / drag to zoom and pan (7 × 7 and up) ──
  const zoomable = n >= 7;
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{ moved: boolean; pinch: { dist: number; zoom: number } | null; start: Pt } | null>(null);

  const onBoardDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    capture(e.currentTarget, e.pointerId);
    if (pointers.current.size === 1) gesture.current = { moved: false, pinch: null, start: { x: e.clientX, y: e.clientY } };
    else if (pointers.current.size === 2 && zoomable && gesture.current) {
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      gesture.current.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.current.zoom };
      gesture.current.moved = true;
    }
  };
  const onBoardMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    const g = gesture.current;
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
    const g = gesture.current;
    if (pointers.current.size > 0) return;
    gesture.current = null;
    if (!g || g.moved || e.type === "pointercancel") return;
    const p = geo().toBoard({ x: e.clientX, y: e.clientY });
    tryPlaceAt(cellAt(puzzle, p.x, p.y));
  };

  /** Tap-to-place / keyboard: put the selected piece in a cell — only if it's its own cell. */
  const tryPlaceAt = (cell: number | null) => {
    const id = latest.current.selected;
    if (id === null || cell === null || latest.current.placed.has(cell)) return;
    if (cell !== id) {
      // Not its spot: a little shake, the piece stays selected.
      if (!reduced.current) svgRef.current?.animate?.([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 260 });
      return;
    }
    const btn = trayButton(id);
    if (!btn || reduced.current) return place(id);
    // Fly the piece from the tray to its spot.
    const r = btn.getBoundingClientRect();
    const g = geo();
    const k = r.width / ((puzzle.cellW + puzzle.pad * 2) * g.scale);
    lift(id);
    later(() => {
      const el = ghostRef.current;
      if (!el) return;
      const { x, y } = toLocal({ x: r.left, y: r.top });
      el.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      void snapInto(id);
    }, 0);
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

  const remaining = order.filter((id) => !placed.has(id));
  const placedPaths = useMemo(() => [...placed].map((id) => puzzle.pieces[id]!.path), [placed, puzzle]);
  const imgProps = { href: image, x: 0, y: 0, width: puzzle.w, height: puzzle.h, preserveAspectRatio: "xMidYMid slice" } as const;
  const liftedPiece = lifted ? puzzle.pieces[lifted.id]! : null;

  return (
    <div className={s.puzzle}>
      <div className={s.toolbar}>
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

        <div ref={trayRef} className={s.tray} role="listbox" aria-label="Puzzle pieces" style={{ touchAction: wide ? "pan-y" : "pan-x" }}>
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

        {selected !== null && !solved && (
          <p className={s.selectedHint}>
            Now tap its spot on the board ·{" "}
            <button type="button" onClick={() => setSelected(null)}>
              Cancel
            </button>
          </p>
        )}

        {liftedPiece && lifted && (
          <div ref={ghostRef} className={s.ghost} style={{ width: lifted.w, height: lifted.h }} aria-hidden>
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
