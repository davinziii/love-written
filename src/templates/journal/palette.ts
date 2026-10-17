/**
 * Journal — the curated colors. Shared by the definition (editor options) and the
 * renderer (actual CSS values), so the two can't drift.
 */

export const BACKGROUNDS = [
  { id: "dusk", label: "Dusk blue", top: "#454b6b", bottom: "#2c3049" },
  { id: "charcoal", label: "Charcoal", top: "#3a3a40", bottom: "#1f1f23" },
  { id: "plum", label: "Plum", top: "#55405c", bottom: "#2f2335" },
  { id: "forest", label: "Forest", top: "#3d5a51", bottom: "#22352f" },
  { id: "cocoa", label: "Cocoa", top: "#5a463c", bottom: "#33261f" },
] as const;

/** Words sit on top of photos, so each color carries the soft shadow that keeps it readable. */
export const WORD_COLORS = [
  { id: "white", label: "White", hint: "Best on darker photos", value: "#ffffff", shadow: "0 1px 3px rgb(0 0 0 / 0.55), 0 0 14px rgb(0 0 0 / 0.35)" },
  { id: "black", label: "Black", hint: "Best on bright photos", value: "#141414", shadow: "0 1px 2px rgb(255 255 255 / 0.5), 0 0 12px rgb(255 255 255 / 0.35)" },
  { id: "cream", label: "Cream", value: "#fff3d6", shadow: "0 1px 3px rgb(0 0 0 / 0.55), 0 0 14px rgb(0 0 0 / 0.3)" },
  { id: "blush", label: "Blush pink", value: "#ffc4d3", shadow: "0 1px 3px rgb(0 0 0 / 0.55), 0 0 14px rgb(0 0 0 / 0.3)" },
  { id: "sky", label: "Sky blue", value: "#bfe3ff", shadow: "0 1px 3px rgb(0 0 0 / 0.55), 0 0 14px rgb(0 0 0 / 0.3)" },
  { id: "gold", label: "Gold", value: "#ffd66b", shadow: "0 1px 3px rgb(0 0 0 / 0.6), 0 0 14px rgb(0 0 0 / 0.3)" },
  { id: "navy", label: "Navy", hint: "Best on bright photos", value: "#1d2a4d", shadow: "0 1px 2px rgb(255 255 255 / 0.5), 0 0 12px rgb(255 255 255 / 0.35)" },
] as const;

export const DEFAULT_BACKGROUND = BACKGROUNDS[0].id;
export const DEFAULT_WORD_COLOR = WORD_COLORS[0].id;

export function getBackground(id: string | undefined) {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}

export function getWordColor(id: string | undefined) {
  return WORD_COLORS.find((c) => c.id === id) ?? WORD_COLORS[0];
}
