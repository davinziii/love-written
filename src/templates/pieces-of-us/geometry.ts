/**
 * Pieces of Us — jigsaw geometry (no React, no DOM).
 *
 * The board is cut along a grid. Every edge *between* two pieces is generated once, as a
 * curve in board coordinates with a knob bulging into one of the two pieces. The piece on
 * one side walks that curve forwards and its neighbour walks the very same curve backwards,
 * so knob and socket always fit exactly — no gaps, no overlaps. Edges on the outside of the
 * board are straight. Shapes come from a seed, so they never change between renders.
 */

export type Pt = { x: number; y: number };
/** One cubic Bézier segment: two control points and the end point (the start is the previous end). */
type Seg = readonly [Pt, Pt, Pt];
export type Edge = { start: Pt; end: Pt; segs: readonly Seg[] };

export type Piece = {
  /** row * n + col — also the piece's id. */
  id: number;
  row: number;
  col: number;
  /** Top-left corner of the piece's cell on the board. */
  x: number;
  y: number;
  /** The piece outline in board coordinates (closed SVG path). */
  path: string;
};

export type Puzzle = {
  n: number;
  /** Board size in board units. */
  w: number;
  h: number;
  cellW: number;
  cellH: number;
  /** How far knobs can reach outside a cell (board units) — room to leave around a piece. */
  pad: number;
  pieces: Piece[];
  /** Straight-line flags for tests: [row][col] of internal edges, +1 / -1. */
  hDirs: number[][];
  vDirs: number[][];
};

/** Board width in board units; the height follows the photo's shape. */
export const BOARD_W = 1000;
/** Photos are cut at most this tall / wide (portrait 3:4 … landscape 4:3); the rest is cropped. */
export const MIN_ASPECT = 3 / 4;
export const MAX_ASPECT = 4 / 3;

/** Small, fast, seeded random numbers (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The classic knob, drawn along a unit edge: (t along, n outward) for each control point.
 * Base → narrow neck → round head → neck → base. Points in the middle (0.3–0.7) are sized
 * by the piece's smaller side, so knobs stay round on non-square pieces.
 */
const KNOB: readonly (readonly [number, number])[][] = [
  [[0.3, 0], [0.46, -0.01], [0.44, 0.05]],
  [[0.43, 0.08], [0.38, 0.11], [0.38, 0.16]],
  [[0.38, 0.22], [0.44, 0.27], [0.5, 0.27]],
  [[0.56, 0.27], [0.62, 0.22], [0.62, 0.16]],
  [[0.62, 0.11], [0.57, 0.08], [0.56, 0.05]],
  [[0.54, -0.01], [0.7, 0], [1, 0]],
];
/** How far the head reaches out, as a share of the piece's smaller side. */
export const KNOB_REACH = 0.27;

function knobEdge(start: Pt, end: Pt, dir: 1 | -1, size: number, rand: () => number): Edge {
  const len = Math.hypot(end.x - start.x, end.y - start.y);
  const ux = (end.x - start.x) / len;
  const uy = (end.y - start.y) / len;
  // Normal: +1 bends to the right of the direction of travel (down for a left→right edge).
  const nx = -uy * dir;
  const ny = ux * dir;
  // A little variety, so the pieces look cut by hand: the knob shifts and grows slightly.
  const shift = (rand() - 0.5) * 0.12;
  const grow = 0.92 + rand() * 0.16;
  const at = ([t, n]: readonly [number, number]): Pt => {
    const along = t > 0.29 && t < 0.71 ? len / 2 + (t - 0.5 + shift) * size * grow : t * len;
    const out = n * size * grow;
    return { x: start.x + ux * along + nx * out, y: start.y + uy * along + ny * out };
  };
  return { start, end, segs: KNOB.map((seg) => [at(seg[0]!), at(seg[1]!), at(seg[2]!)] as const) };
}

function straight(start: Pt, end: Pt): Edge {
  return { start, end, segs: [[start, end, end]] };
}

function reversed(e: Edge): Edge {
  const pts: Pt[] = [e.start];
  for (const s of e.segs) pts.push(s[0], s[1], s[2]);
  pts.reverse(); // end, c2, c1, …, start
  const segs: Seg[] = [];
  for (let i = 1; i < pts.length; i += 3) segs.push([pts[i]!, pts[i + 1]!, pts[i + 2]!]);
  return { start: e.end, end: e.start, segs };
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const segsToPath = (e: Edge) => e.segs.map(([a, b, c]) => `C${r2(a.x)} ${r2(a.y)} ${r2(b.x)} ${r2(b.y)} ${r2(c.x)} ${r2(c.y)}`).join("");

/** Board size for a photo's shape (width ÷ height), clamped to the allowed range. */
export function boardSize(aspect: number) {
  const a = Number.isFinite(aspect) && aspect > 0 ? Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect)) : 1;
  return { w: BOARD_W, h: Math.round(BOARD_W / a) };
}

/** Cut an n × n puzzle for a board of w × h. Same seed → same pieces. */
export function makePuzzle(n: number, w: number, h: number, seed: number): Puzzle {
  const rand = seeded(seed);
  const cellW = w / n;
  const cellH = h / n;
  const size = Math.min(cellW, cellH);
  const pt = (c: number, r: number): Pt => ({ x: c * cellW, y: r * cellH });

  // h[r][c]: the edge along the top of row r (r = 1 … n-1), left → right; +1 = knob points down.
  const hDirs: number[][] = [];
  const hEdges: Edge[][] = [];
  for (let r = 1; r < n; r++) {
    hDirs[r] = [];
    hEdges[r] = [];
    for (let c = 0; c < n; c++) {
      const dir = rand() < 0.5 ? 1 : -1;
      hDirs[r]![c] = dir;
      hEdges[r]![c] = knobEdge(pt(c, r), pt(c + 1, r), dir, size, rand);
    }
  }
  // v[r][c]: the edge along the left of column c (c = 1 … n-1), top → bottom; +1 = knob points left.
  const vDirs: number[][] = [];
  const vEdges: Edge[][] = [];
  for (let r = 0; r < n; r++) {
    vDirs[r] = [];
    vEdges[r] = [];
    for (let c = 1; c < n; c++) {
      const dir = rand() < 0.5 ? 1 : -1;
      vDirs[r]![c] = dir;
      vEdges[r]![c] = knobEdge(pt(c, r), pt(c, r + 1), dir, size, rand);
    }
  }

  const pieces: Piece[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const top = row === 0 ? straight(pt(col, row), pt(col + 1, row)) : hEdges[row]![col]!;
      const right = col === n - 1 ? straight(pt(col + 1, row), pt(col + 1, row + 1)) : vEdges[row]![col + 1]!;
      const bottom = row === n - 1 ? straight(pt(col + 1, row + 1), pt(col, row + 1)) : reversed(hEdges[row + 1]![col]!);
      const left = col === 0 ? straight(pt(col, row + 1), pt(col, row)) : reversed(vEdges[row]![col]!);
      const o = pt(col, row);
      pieces.push({
        id: row * n + col,
        row,
        col,
        x: o.x,
        y: o.y,
        path: `M${r2(o.x)} ${r2(o.y)}${segsToPath(top)}${segsToPath(right)}${segsToPath(bottom)}${segsToPath(left)}Z`,
      });
    }
  }
  return { n, w, h, cellW, cellH, pad: size * (KNOB_REACH + 0.06), pieces, hDirs, vDirs };
}

/** All the cut lines of the board as one path (for the faint outlines of the empty slots). */
export function cutLines(p: Puzzle): string {
  return p.pieces.map((pc) => pc.path).join("");
}

/**
 * How close (in board units) a dropped piece must be to its spot to snap in. A share of the
 * piece size, but never smaller than a comfortable number of screen pixels (more for fingers),
 * and never so big that a piece snaps from the next slot over.
 */
export function snapRadius(p: Puzzle, screenScale: number, touch: boolean): number {
  const size = Math.min(p.cellW, p.cellH);
  const minPx = touch ? 26 : 16;
  return Math.min(size * 0.5, Math.max(size * 0.32, minPx / Math.max(screenScale, 0.0001)));
}

/** Pieces in a shuffled tray order (seeded). Never leaves the puzzle already solved. */
export function shuffledOrder(count: number, seed: number): number[] {
  const rand = seeded(seed ^ 0x9e3779b9);
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  if (count > 1 && order.every((v, i) => v === i)) order.push(order.shift()!);
  return order;
}

/** The cell under a board point, or null when it's off the board. */
export function cellAt(p: Puzzle, x: number, y: number): number | null {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return null;
  return Math.floor(y / p.cellH) * p.n + Math.floor(x / p.cellW);
}
