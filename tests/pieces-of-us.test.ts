import { describe, expect, it } from "vitest";
import { boardSize, cellAt, makePuzzle, shuffledOrder, snapRadius, type Puzzle } from "@/templates/pieces-of-us/geometry";
import { initialStory, reduce, type Action, type StoryState } from "@/templates/pieces-of-us/machine";
import { piecesOfUsDefinition } from "@/templates/pieces-of-us/definition";
import { validateCustomerData } from "@/templates/schema";
import type { TemplateDefinition } from "@/templates/types";

type P = { x: number; y: number };

/** Split a piece path back into its four edges (top, right, bottom, left) as point lists. */
function edgesOf(p: Puzzle, id: number): [P[], P[], P[], P[]] {
  const piece = p.pieces[id]!;
  const nums = piece.path.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const start = { x: nums[0]!, y: nums[1]! };
  const segs: P[][] = [];
  for (let i = 2; i < nums.length; i += 6) {
    segs.push([
      { x: nums[i]!, y: nums[i + 1]! },
      { x: nums[i + 2]!, y: nums[i + 3]! },
      { x: nums[i + 4]!, y: nums[i + 5]! },
    ]);
  }
  const n = p.n;
  const count = [piece.row === 0 ? 1 : 6, piece.col === n - 1 ? 1 : 6, piece.row === n - 1 ? 1 : 6, piece.col === 0 ? 1 : 6];
  expect(segs.length).toBe(count.reduce((a, b) => a + b, 0));
  const out: P[][] = [];
  let from = start;
  let k = 0;
  for (const c of count) {
    const pts = [from];
    for (let i = 0; i < c; i++) pts.push(...segs[k++]!);
    out.push(pts);
    from = pts[pts.length - 1]!;
  }
  return out as [P[], P[], P[], P[]];
}

const close = (a: P[], b: P[]) => {
  expect(a.length).toBe(b.length);
  a.forEach((p, i) => {
    expect(p.x).toBeCloseTo(b[i]!.x, 1);
    expect(p.y).toBeCloseTo(b[i]!.y, 1);
  });
};

describe("pieces of us — jigsaw geometry", () => {
  for (const n of [4, 5, 6, 7, 8]) {
    for (const aspect of [3 / 4, 1, 4 / 3]) {
      it(`${n} × ${n} at ${aspect.toFixed(2)}: neighbours share the same edge, borders are flat`, () => {
        const { w, h } = boardSize(aspect);
        const p = makePuzzle(n, w, h, 1234 + n);
        expect(p.pieces).toHaveLength(n * n);
        const size = Math.min(p.cellW, p.cellH);
        for (const piece of p.pieces) {
          const [top, right, bottom, left] = edgesOf(p, piece.id);
          // Knob below ↔ socket above: the lower piece walks the same curve backwards.
          if (piece.row < n - 1) close(bottom, [...edgesOf(p, piece.id + n)[0]].reverse());
          if (piece.col < n - 1) close(right, [...edgesOf(p, piece.id + 1)[3]].reverse());
          // The outside of the board is a straight line along the board's edge.
          if (piece.row === 0) top.forEach((pt) => expect(pt.y).toBeCloseTo(0, 5));
          if (piece.row === n - 1) bottom.forEach((pt) => expect(pt.y).toBeCloseTo(h, 1));
          if (piece.col === 0) left.forEach((pt) => expect(pt.x).toBeCloseTo(0, 5));
          if (piece.col === n - 1) right.forEach((pt) => expect(pt.x).toBeCloseTo(w, 1));
          // Inside edges really have a knob (not a straight cut), and it stays within the padding.
          for (const [edge, inside, axis, line] of [
            [top, piece.row > 0, "y", piece.y],
            [bottom, piece.row < n - 1, "y", piece.y + p.cellH],
            [left, piece.col > 0, "x", piece.x],
            [right, piece.col < n - 1, "x", piece.x + p.cellW],
          ] as const) {
            if (!inside) continue;
            const reach = Math.max(...edge.map((pt) => Math.abs(pt[axis] - line)));
            expect(reach).toBeGreaterThan(size * 0.2);
            expect(reach).toBeLessThan(p.pad);
          }
          // Every corner is the cell's corner, so pieces tile the photo with no gaps.
          expect(top[0]!.x).toBeCloseTo(piece.x, 1);
          expect(top[0]!.y).toBeCloseTo(piece.y, 1);
        }
      });
    }
  }

  it("each internal edge is a knob on one side and a socket on the other, mixed across the board", () => {
    const p = makePuzzle(8, 1000, 1000, 99);
    const dirs = [...p.hDirs.flat(), ...p.vDirs.flat()].filter((d) => d !== undefined);
    expect(dirs).toHaveLength(2 * 8 * 7);
    expect(dirs.filter((d) => d === 1).length).toBeGreaterThan(20);
    expect(dirs.filter((d) => d === -1).length).toBeGreaterThan(20);
  });

  it("the same seed always cuts the same pieces; another seed cuts differently", () => {
    const a = makePuzzle(6, 1000, 750, 42).pieces.map((x) => x.path);
    const b = makePuzzle(6, 1000, 750, 42).pieces.map((x) => x.path);
    const c = makePuzzle(6, 1000, 750, 43).pieces.map((x) => x.path);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("keeps photos between portrait 3:4 and landscape 4:3", () => {
    expect(boardSize(0.2)).toEqual({ w: 1000, h: 1333 });
    expect(boardSize(5)).toEqual({ w: 1000, h: 750 });
    expect(boardSize(NaN)).toEqual({ w: 1000, h: 1000 });
  });
});

describe("pieces of us — snapping, tray and taps", () => {
  it("snap distance scales with the piece but stays usable from 4 × 4 to 8 × 8", () => {
    for (const n of [4, 8]) {
      const p = makePuzzle(n, 1000, 1000, 1);
      const size = 1000 / n;
      for (const scale of [0.3, 0.6, 1.2]) {
        for (const touch of [true, false]) {
          const r = snapRadius(p, scale, touch);
          expect(r).toBeLessThanOrEqual(size * 0.5); // never reaches the next slot
          expect(r).toBeGreaterThanOrEqual(size * 0.32);
          expect(r * scale).toBeGreaterThanOrEqual(Math.min(touch ? 26 : 16, size * 0.5 * scale) - 0.001);
        }
      }
    }
    // A small 8 × 8 on a phone: fingers get a bigger radius than a mouse.
    const p8 = makePuzzle(8, 1000, 1000, 1);
    expect(snapRadius(p8, 0.3, true)).toBeGreaterThan(snapRadius(p8, 0.3, false));
  });

  it("mixes every piece into the tray exactly once", () => {
    for (const count of [16, 25, 64]) {
      const order = shuffledOrder(count, 7);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => i));
      expect(order).not.toEqual(Array.from({ length: count }, (_, i) => i));
    }
  });

  it("finds the cell under a tap", () => {
    const p = makePuzzle(5, 1000, 750, 1);
    expect(cellAt(p, 10, 10)).toBe(0);
    expect(cellAt(p, 999, 749)).toBe(24);
    expect(cellAt(p, 250, 160)).toBe(5 + 1);
    expect(cellAt(p, -1, 10)).toBeNull();
    expect(cellAt(p, 10, 750)).toBeNull();
  });
});

describe("pieces of us — the story", () => {
  const run = (actions: Action[], from: StoryState) => actions.reduce(reduce, from);
  const solveAll = (total: number) => {
    let s = run([{ type: "open" }], initialStory(total));
    for (let i = 0; i < total; i++) {
      expect(s.scene).toBe("PUZZLE");
      expect(s.current).toBe(i);
      s = run([{ type: "solved" }], s);
      expect(s.scene).toBe("MEMORY");
      s = run([{ type: "next" }], s);
    }
    return s;
  };

  for (const total of [1, 2, 3]) {
    it(`${total} puzzle(s): invitation → puzzles → memories → missing piece → letter`, () => {
      let s = solveAll(total);
      expect(s.scene).toBe("MISSING");
      expect(s.done).toBe(total);
      s = run([{ type: "goldenPlaced" }], s);
      expect(s.scene).toBe("LETTER");
    });
  }

  it("the letter can't open early and a double 'solved' can't skip a memory", () => {
    let s = run([{ type: "open" }, { type: "goldenPlaced" }, { type: "showLetter" }], initialStory(3));
    expect(s.scene).toBe("PUZZLE");
    s = run([{ type: "solved" }, { type: "solved" }], s);
    expect(s.done).toBe(1);
    expect(s.scene).toBe("MEMORY");
  });

  it("restart mixes just this puzzle again; replay starts the whole story over", () => {
    let s = run([{ type: "open" }, { type: "solved" }, { type: "next" }], initialStory(3));
    s = run([{ type: "overlay", overlay: "CONFIRM_RESTART" }, { type: "restartPuzzle" }], s);
    expect(s).toMatchObject({ scene: "PUZZLE", current: 1, done: 1, attempt: 1, overlay: null });
    s = run([{ type: "overlay", overlay: "CONFIRM_REPLAY" }, { type: "replay" }], s);
    expect(s).toEqual(initialStory(3, 1));
  });

  it("memories can be reopened once there are some; the letter can be revisited after the end", () => {
    let s = run([{ type: "open" }, { type: "overlay", overlay: "GALLERY" }], initialStory(2));
    expect(s.overlay).toBeNull();
    s = solveAll(2);
    s = run([{ type: "goldenPlaced" }, { type: "overlay", overlay: "GALLERY" }], s);
    expect(s.overlay).toBe("GALLERY");
    s = run([{ type: "closeOverlay" }], s);
    expect(s.scene).toBe("LETTER");
  });

  it("changing the number of puzzles in the editor starts over", () => {
    const s = run([{ type: "open" }, { type: "setTotal", total: 1 }], initialStory(3));
    expect(s).toEqual(initialStory(1, 1));
  });
});

describe("pieces of us — editor fields", () => {
  const t = piecesOfUsDefinition as TemplateDefinition;

  it("offers every difficulty from 4 × 4 to 8 × 8 with a grid preview, 5 × 5 by default", () => {
    const f = t.fields.find((x) => x.id === "difficulty")!;
    expect(f.type).toBe("choice");
    if (f.type !== "choice") return;
    expect(f.default).toBe("5");
    expect(f.options.map((o) => o.grid?.[0])).toEqual([4, 5, 6, 7, 8]);
    expect(f.gridPreview?.imageField).toBe("memory_photo_1");
  });

  it("only the first photo is required; the sample passes strict validation", () => {
    const photos = t.fields.filter((f) => f.type === "image");
    expect(photos.map((f) => Boolean(f.required))).toEqual([true, false, false]);
    const content: Record<string, string> = {};
    for (const [k, v] of Object.entries(t.sample)) if (!k.startsWith("memory_photo")) content[k] = v;
    const r = validateCustomerData(t, { content, style: t.sample }, { mode: "strict", imageFieldsPresent: new Set(["memory_photo_1"]) });
    expect(r.errors).toEqual({});
  });
});
