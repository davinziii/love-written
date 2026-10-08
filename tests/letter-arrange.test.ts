import { describe, expect, it } from "vitest";
import { arrangeDesktop, arrangeStack, photoHeight, PHOTO_STYLES, sideColumns } from "@/templates/letter-for-you/arrange";

const ten = Array.from({ length: 10 }, (_, i) => i);
const twelve = Array.from({ length: 12 }, (_, i) => i);
const SIDE = 290; // room beside the letter on a ~1280px screen

describe("Letter for You photo arrangement", () => {
  it("stack: two photos above the letter, the rest below", () => {
    const p = arrangeStack(ten);
    expect(p.filter((x) => x.group === "top").map((x) => x.index)).toEqual([0, 1]);
    expect(p.filter((x) => x.group === "bottom")).toHaveLength(8);
  });

  it("desktop: every photo is placed exactly once", () => {
    for (const h of [0, 300, 700, 1200, 3000]) {
      for (const side of [0, 180, SIDE, 460]) {
        const { placements } = arrangeDesktop(twelve, h, side);
        expect(placements.map((x) => x.index).sort((a, b) => a - b)).toEqual(twelve);
        expect(placements.map((x) => x.order).sort((a, b) => a - b)).toEqual(twelve);
      }
    }
  });

  it("desktop: a short letter sends more photos to the bottom than a long one", () => {
    const bottom = (h: number) => arrangeDesktop(twelve, h, SIDE).placements.filter((x) => x.group === "bottom").length;
    expect(bottom(600)).toBeGreaterThan(bottom(1600));
    expect(bottom(6000)).toBe(0);
  });

  it("desktop: no room beside the letter → everything goes below", () => {
    expect(arrangeDesktop(twelve, 1200, 0).placements.every((x) => x.group === "bottom")).toBe(true);
  });

  it("desktop: wide sides get two columns, narrow sides one", () => {
    expect(sideColumns(460).cols).toBe(2);
    expect(sideColumns(SIDE).cols).toBe(1);
    expect(sideColumns(SIDE).colWidth).toBeLessThanOrEqual(300);
  });

  it("desktop: no column grows much taller than the letter", () => {
    const letterH = 900;
    for (const side of [SIDE, 460]) {
      const { placements, cols } = arrangeDesktop(twelve, letterH, side);
      for (const group of ["left", "right"] as const) {
        for (let c = 0; c < cols; c++) {
          const used = placements
            .filter((x) => x.group === group && x.col === c)
            .reduce((sum, x) => sum + photoHeight(PHOTO_STYLES[x.index]!, x.widthPx), 0);
          expect(used).toBeLessThanOrEqual(letterH + 64);
        }
      }
      expect(placements.some((x) => x.group === "left")).toBe(true);
      expect(placements.some((x) => x.group === "right")).toBe(true);
    }
  });

  it("desktop: photos beside the letter reveal before the ones below", () => {
    const { placements } = arrangeDesktop(twelve, 700, SIDE);
    const sideMax = Math.max(...placements.filter((x) => x.group !== "bottom").map((x) => x.order));
    const bottomMin = Math.min(...placements.filter((x) => x.group === "bottom").map((x) => x.order));
    expect(sideMax).toBeLessThan(bottomMin);
  });

  it("uses a mix of sizes and trims", () => {
    expect(new Set(PHOTO_STYLES.map((s) => s.size)).size).toBe(3);
    expect(new Set(PHOTO_STYLES.map((s) => s.deco)).size).toBe(3);
  });
});
