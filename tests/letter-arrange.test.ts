import { describe, expect, it } from "vitest";
import { arrangeDesktop, arrangeStack, photoHeight, PHOTO_STYLES } from "@/templates/letter-for-you/arrange";

const ten = Array.from({ length: 10 }, (_, i) => i);
const twelve = Array.from({ length: 12 }, (_, i) => i);

describe("Letter for You photo arrangement", () => {
  it("stack: two photos above the letter, the rest below", () => {
    const p = arrangeStack(ten);
    expect(p.filter((x) => x.group === "top").map((x) => x.index)).toEqual([0, 1]);
    expect(p.filter((x) => x.group === "bottom")).toHaveLength(8);
  });

  it("desktop: every photo is placed exactly once", () => {
    for (const h of [0, 300, 700, 1200, 3000]) {
      const p = arrangeDesktop(twelve, h);
      expect(p.map((x) => x.index).sort((a, b) => a - b)).toEqual(twelve);
      expect(p.map((x) => x.order).sort((a, b) => a - b)).toEqual(twelve);
    }
  });

  it("desktop: a short letter sends more photos to the bottom than a long one", () => {
    const bottom = (h: number) => arrangeDesktop(twelve, h).filter((x) => x.group === "bottom").length;
    expect(bottom(500)).toBeGreaterThan(bottom(1400));
    expect(bottom(4000)).toBe(0);
  });

  it("desktop: side columns never grow much taller than the letter", () => {
    const letterH = 900;
    const p = arrangeDesktop(twelve, letterH);
    for (const side of ["left", "right"] as const) {
      const used = p
        .filter((x) => x.group === side)
        .reduce((sum, x) => sum + photoHeight(PHOTO_STYLES[x.index]!), 0);
      expect(used).toBeLessThanOrEqual(letterH + 48);
    }
    expect(p.some((x) => x.group === "left")).toBe(true);
    expect(p.some((x) => x.group === "right")).toBe(true);
  });

  it("desktop: photos beside the letter reveal before the ones below", () => {
    const p = arrangeDesktop(twelve, 700);
    const sideMax = Math.max(...p.filter((x) => x.group !== "bottom").map((x) => x.order));
    const bottomMin = Math.min(...p.filter((x) => x.group === "bottom").map((x) => x.order));
    expect(sideMax).toBeLessThan(bottomMin);
  });

  it("uses a mix of sizes", () => {
    expect(new Set(PHOTO_STYLES.map((s) => s.size)).size).toBe(3);
  });
});
