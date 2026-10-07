import { describe, expect, it } from "vitest";
import { CONTENT_REPORT_REASONS } from "@/lib/report-reasons";
import { FINAL_FONT_IDS, FONTS, STORY_FONT_IDS, THEMES } from "@/templates/styles";

describe("abuse report reasons", () => {
  it("cover the rules listed on the Terms page", () => {
    expect(Object.keys(CONTENT_REPORT_REASONS)).toEqual(["harassment", "explicit", "hate", "impersonation", "private_info", "other"]);
  });
});

describe("curated styles", () => {
  it("has ten themes with every color set", () => {
    expect(Object.keys(THEMES)).toHaveLength(10);
    for (const t of Object.values(THEMES)) {
      for (const k of ["bg", "surface", "ink", "muted", "accent", "accentInk", "glow"] as const) expect(t[k]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
  it("story and final font lists don't overlap and all exist", () => {
    for (const id of [...STORY_FONT_IDS, ...FINAL_FONT_IDS]) expect(FONTS[id]).toBeDefined();
    expect(STORY_FONT_IDS.filter((id) => (FINAL_FONT_IDS as readonly string[]).includes(id))).toEqual([]);
  });
});
