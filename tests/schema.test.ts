import { describe, expect, it } from "vitest";
import { validateCustomerData, missingRequiredFields } from "@/templates/schema";
import { ourStoryDefinition } from "@/templates/our-story/definition";
import { TEMPLATES } from "@/templates";
import type { TemplateDefinition } from "@/templates/types";

const t = ourStoryDefinition as TemplateDefinition;
const allImages = new Set(t.fields.filter((f) => f.type === "image").map((f) => f.id));
const noImages = new Set<string>();

describe("generic schema validation", () => {
  it("accepts an empty draft and fills style defaults", () => {
    const r = validateCustomerData(t, { content: {}, style: {} }, { mode: "draft", imageFieldsPresent: noImages });
    expect(r.ok).toBe(true);
    expect(r.data.style).toEqual({ theme: "blush", font: "classic", music: "none" });
  });

  it("strict mode reports every missing required field, including photos", () => {
    const r = validateCustomerData(t, { content: {}, style: {} }, { mode: "strict", imageFieldsPresent: noImages });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(
      ["final_message", "intro_message", "memory_1", "memory_photo_1", "recipient_name", "sender_name"].sort(),
    );
  });

  it("the template's own sample data passes strict validation", () => {
    const content: Record<string, string> = {};
    for (const [k, v] of Object.entries(t.sample)) if (!k.startsWith("memory_photo")) content[k] = v;
    const r = validateCustomerData(t, { content, style: t.sample }, { mode: "strict", imageFieldsPresent: allImages });
    expect(r.errors).toEqual({});
  });

  it("enforces max length in characters (emoji count once)", () => {
    const ok = validateCustomerData(t, { content: { recipient_name: "💖".repeat(40) } }, { mode: "draft", imageFieldsPresent: noImages });
    expect(ok.ok).toBe(true);
    const tooLong = validateCustomerData(t, { content: { recipient_name: "a".repeat(41) } }, { mode: "draft", imageFieldsPresent: noImages });
    expect(tooLong.errors.recipient_name).toMatch(/under 40/);
  });

  it("treats HTML as plain text and strips control characters", () => {
    const r = validateCustomerData(
      t,
      { content: { recipient_name: "<script>alert(1)</script>\u0000", intro_message: "line1\r\nline2\u0007" } },
      { mode: "draft", imageFieldsPresent: noImages },
    );
    expect(r.data.content.recipient_name).toBe("<script>alert(1)</script>");
    expect(r.data.content.intro_message).toBe("line1\nline2");
  });

  it("rejects style values outside the curated options", () => {
    const r = validateCustomerData(t, { style: { theme: "hotpink", font: "comic-sans", music: "spotify:track" } }, { mode: "draft", imageFieldsPresent: noImages });
    expect(Object.keys(r.errors).sort()).toEqual(["font", "music", "theme"]);
  });

  it("rejects invalid dates and non-string values", () => {
    const r = validateCustomerData(
      t,
      { content: { together_since: "2023-02-30", memory_date_1: "yesterday", recipient_name: 42 as unknown as string } },
      { mode: "draft", imageFieldsPresent: noImages },
    );
    expect(r.errors.together_since).toBeDefined();
    expect(r.errors.memory_date_1).toBeDefined();
    expect(r.errors.recipient_name).toBe("Invalid value");
  });

  it("drops unknown keys instead of storing them", () => {
    const r = validateCustomerData(t, { content: { evil: "x", recipient_name: "Sam" } }, { mode: "draft", imageFieldsPresent: noImages });
    expect(r.data.content).toEqual({ recipient_name: "Sam" });
  });

  it("missingRequiredFields mirrors strict validation", () => {
    const missing = missingRequiredFields(t, { content: { recipient_name: "Sam" }, style: {} }, noImages).map((f) => f.id);
    expect(missing).toContain("memory_photo_1");
    expect(missing).not.toContain("recipient_name");
  });
});

describe("template registry", () => {
  for (const def of Object.values(TEMPLATES as Record<string, TemplateDefinition>)) {
    it(`${def.id}: field ids are unique and semantic`, () => {
      const ids = def.fields.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(id).not.toMatch(/^(top|bottom|left|right)_/);
      }
    });
    it(`${def.id}: sample covers every required field`, () => {
      for (const f of def.fields.filter((x) => x.required)) expect(def.sample[f.id], f.id).toBeTruthy();
    });
  }
});
