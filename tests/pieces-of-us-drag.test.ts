import { describe, expect, it } from "vitest";
import {
  DRAG_SLOP,
  DragGesture,
  boardToClient,
  clientToBoard,
  clientToLocal,
  ghostTopLeft,
  grabOffset,
  heldCorner,
  topLeftForScaled,
  type Rect,
  type View,
} from "@/templates/pieces-of-us/drag";

const near = (a: { x: number; y: number }, b: { x: number; y: number }, digits = 6) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

describe("pieces of us — coordinates", () => {
  const views: View[] = [
    { zoom: 1, x: 0, y: 0 },
    { zoom: 2, x: -480, y: -600 }, // zoomed in and panned
    { zoom: 2.6, x: -1600, y: -200 },
  ];
  // The same board on screen in different situations: scrolled up, scrolled down past it
  // (negative top), and shrunk inside the editor's preview frame.
  const rects: Rect[] = [
    { left: 14, top: 96, width: 292, height: 365 },
    { left: 14, top: -820, width: 292, height: 365 },
    { left: 380, top: 140, width: 146, height: 182.5 },
  ];

  it("client → board → client is exact for every zoom, pan, scroll and scale", () => {
    for (const v of views)
      for (const r of rects)
        for (const p of [
          { x: 0, y: 0 },
          { x: 500, y: 625 },
          { x: 1000, y: 1250 },
          { x: 123.4, y: 987.6 },
        ])
          near(clientToBoard(boardToClient(p, r, 1000, v), r, 1000, v), p);
  });

  it("a board corner lands where the zoom and pan say it should", () => {
    const r = rects[0]!;
    const k = r.width / 1000;
    const v = views[1]!;
    near(boardToClient({ x: 250, y: 500 }, r, 1000, v), { x: r.left + (250 * 2 - 480) * k, y: r.top + (500 * 2 - 600) * k });
  });

  it("client → local undoes the preview frame's shrink, and is the identity on a normal page", () => {
    near(clientToLocal({ x: 120, y: 260 }, { left: 20, top: 60, width: 375, height: 812 }, 375), { x: 100, y: 200 });
    // Shown at half size: one client pixel is two local pixels.
    near(clientToLocal({ x: 120, y: 260 }, { left: 20, top: 60, width: 187.5, height: 406 }, 375), { x: 200, y: 400 });
  });

  it("picking up keeps the held spot under the pointer: the floating piece starts exactly over the tray piece", () => {
    const tray: Rect = { left: 100, top: 700, width: 60, height: 70 };
    const fullW = 90; // the same box at board size
    const pointer = { x: 112, y: 735 }; // grabbed near its left edge
    const grab = grabOffset(pointer, tray, fullW);
    const ratio = tray.width / fullW;
    // Scaled down to the tray size around the grab point, the box's visible corner is the tray button's corner…
    const topLeft = ghostTopLeft(pointer, grab);
    near({ x: topLeft.x + grab.x * (1 - ratio), y: topLeft.y + grab.y * (1 - ratio) }, { x: tray.left, y: tray.top });
    // …and at any scale the grab point itself stays at the pointer.
    for (const scale of [ratio, 1, 1.06]) near({ x: topLeft.x + grab.x, y: topLeft.y + grab.y }, pointer);
  });

  it("the held piece's corner follows the pointer one-to-one, with no jump", () => {
    const grab = { x: 40, y: 55 };
    const pad = 12;
    const a = heldCorner({ x: 200, y: 300 }, grab, pad, 1.06);
    const b = heldCorner({ x: 260, y: 180 }, grab, pad, 1.06);
    near({ x: b.x - a.x, y: b.y - a.y }, { x: 60, y: -120 });
    // At full size, the corner is just the box corner plus the knob room.
    near(heldCorner({ x: 200, y: 300 }, grab, pad, 1), { x: 200 - grab.x + pad, y: 300 - grab.y + pad });
  });

  it("flying home lands the scaled box exactly on the tray button", () => {
    const origin = { x: 30, y: 44 };
    const scale = 0.7;
    const tl = topLeftForScaled({ x: 100, y: 700 }, origin, scale);
    near({ x: tl.x + origin.x * (1 - scale), y: tl.y + origin.y * (1 - scale) }, { x: 100, y: 700 });
  });
});

describe("pieces of us — drag gesture", () => {
  const at = (x: number, y: number) => ({ x, y });

  it("a press that barely moves is a tap; past the slop it's a drag right away (no delay)", () => {
    const g = new DragGesture();
    g.down(1, 5, "touch", at(100, 100));
    expect(g.move(1, at(100 + DRAG_SLOP.touch - 1, 100))).toBe("pending");
    expect(g.up(1, at(103, 100))).toBe("tap");
    expect(g.active).toBe(false);

    g.down(2, 5, "touch", at(100, 100));
    expect(g.move(2, at(100, 100 - DRAG_SLOP.touch - 1))).toBe("start");
    expect(g.move(2, at(140, 20))).toBe("move");
    expect(g.up(2, at(150, 10))).toBe("drop");
  });

  it("drags start in any direction — sideways and diagonal too", () => {
    for (const [dx, dy] of [
      [10, 0],
      [-10, 0],
      [7, -7],
      [0, 10],
    ] as const) {
      const g = new DragGesture();
      g.down(1, 0, "touch", at(50, 50));
      expect(g.move(1, at(50 + dx, 50 + dy))).toBe("start");
    }
  });

  it("other fingers can't move, drop or cancel someone else's piece", () => {
    const g = new DragGesture();
    g.down(1, 3, "touch", at(0, 0));
    g.move(1, at(20, 0));
    expect(g.move(2, at(200, 200))).toBe("ignore");
    expect(g.up(2, at(200, 200))).toBe("ignore");
    expect(g.cancel(2)).toBe("ignore");
    expect(g.dragging).toBe(true);
    expect(g.up(1, at(30, 0))).toBe("drop");
  });

  it("a cancelled touch ends the drag (the piece goes home) and never leaves it stuck", () => {
    const g = new DragGesture();
    g.down(1, 3, "touch", at(0, 0));
    g.move(1, at(30, 0));
    expect(g.cancel(1)).toBe("cancel-drag");
    expect(g.active).toBe(false);
    expect(g.move(1, at(60, 0))).toBe("ignore");
  });

  it("a press whose release was lost is replaced by the next press", () => {
    const g = new DragGesture();
    g.down(1, 3, "mouse", at(0, 0));
    g.move(1, at(30, 0));
    expect(g.down(2, 4, "mouse", at(5, 5))).toBe("replaced-drag");
    expect(g.pieceId).toBe(4);
    expect(g.dragging).toBe(false);
  });

  it("repeatedly picking up and dropping the same piece works every time", () => {
    const g = new DragGesture();
    for (let i = 0; i < 50; i++) {
      expect(g.down(i, 7, i % 2 ? "touch" : "mouse", at(10, 10))).toBe("fresh");
      expect(g.move(i, at(40, 10))).toBe("start");
      expect(g.up(i, at(40, 10))).toBe("drop");
    }
  });
});
