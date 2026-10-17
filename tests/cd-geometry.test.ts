import { describe, expect, it } from "vitest";
import { bounds, caseScreenWidth, layoutCollection, project } from "@/templates/cd-collection/geometry";
import { TEMPLATES } from "@/templates";
import { validateCustomerData } from "@/templates/schema";
import type { TemplateDefinition } from "@/templates/types";

const desktop = { width: 1280, height: 800, margin: [84, 56, 110, 56] as const };
const phone = { width: 375, height: 812, margin: [72, 18, 96, 18] as const };

describe("CD collection geometry", () => {
  it("the row rises from bottom-left to top-right", () => {
    const front = project([0, 0, 0]);
    const back = project([0, 0, -100]);
    expect(back[0]).toBeGreaterThan(front[0]);
    expect(back[1]).toBeLessThan(front[1]);
  });

  it("fewer CDs are drawn bigger, more CDs smaller — continuously", () => {
    const scales = [8, 12, 16, 20, 25, 30].map((n) => layoutCollection(n, desktop).scale);
    for (let i = 1; i < scales.length; i++) expect(scales[i]!).toBeLessThanOrEqual(scales[i - 1]!);
    expect(scales[0]!).toBeGreaterThan(scales.at(-1)!);
  });

  it("fits the whole collection on a desktop screen", () => {
    for (const n of [8, 18, 30]) {
      const l = layoutCollection(n, desktop);
      expect(l.pan).toBe(false);
      expect(l.width).toBe(desktop.width);
      expect(l.height).toBe(desktop.height);
      const b = bounds(n);
      expect((b.maxX - b.minX) * l.scale).toBeLessThanOrEqual(desktop.width - 56 * 2 + 0.5);
      expect((b.maxY - b.minY) * l.scale).toBeLessThanOrEqual(desktop.height - 84 - 110 + 0.5);
    }
  });

  it("never shrinks cases below a legible size on a phone — it pans instead", () => {
    const l = layoutCollection(30, phone);
    expect(caseScreenWidth(l.scale)).toBeGreaterThanOrEqual(64);
    expect(l.pan).toBe(true);
    expect(l.width).toBeGreaterThan(phone.width);
  });

  it("pulls a case out in proportion to its size at every zoom", () => {
    const small = layoutCollection(30, desktop);
    const big = layoutCollection(8, desktop);
    const ratio = (l: typeof small) => Math.hypot(...l.cases[0]!.extract) / caseScreenWidth(l.scale);
    expect(ratio(small)).toBeCloseTo(ratio(big), 6);
  });

  it("one case per memory", () => {
    expect(layoutCollection(13, desktop).cases).toHaveLength(13);
  });
});

describe("CD collection template", () => {
  const t = TEMPLATES["cd-collection"] as TemplateDefinition;
  it("requires the first eight covers and offers thirty CDs", () => {
    const r = validateCustomerData(t, { content: {}, style: {} }, { mode: "strict", imageFieldsPresent: new Set() });
    expect(Object.keys(r.errors).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => `cd_photo_${n}`).sort());
    expect(t.fields.filter((f) => f.id.startsWith("cd_photo_"))).toHaveLength(30);
  });
});
