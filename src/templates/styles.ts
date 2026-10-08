/**
 * Curated appearance options shared by all templates.
 * Customers can only pick from these — no custom colors, fonts or music.
 */

export interface Theme {
  id: string;
  label: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
  glow: string;
}

export const THEMES = {
  blush: {
    id: "blush",
    label: "Blush",
    bg: "#FBF1EE",
    surface: "#FFFFFF",
    ink: "#3B2A2F",
    muted: "#8C6F76",
    accent: "#C4486A",
    accentInk: "#FFFFFF",
    glow: "#F5C6D1",
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    bg: "#15121F",
    surface: "#211D30",
    ink: "#F6EEF1",
    muted: "#A99FBA",
    accent: "#EBA3B8",
    accentInk: "#15121F",
    glow: "#4A3870",
  },
  sunset: {
    id: "sunset",
    label: "Golden Hour",
    bg: "#FFF3E6",
    surface: "#FFFCF7",
    ink: "#3E2617",
    muted: "#8F6A52",
    accent: "#D2602E",
    accentInk: "#FFFFFF",
    glow: "#FFCFA8",
  },
  sage: {
    id: "sage",
    label: "Sage",
    bg: "#EFF3EC",
    surface: "#FFFFFF",
    ink: "#24302A",
    muted: "#6A7B6F",
    accent: "#4F7F5E",
    accentInk: "#FFFFFF",
    glow: "#C9DEC9",
  },
  lavender: {
    id: "lavender",
    label: "Lavender",
    bg: "#F4F0FB",
    surface: "#FFFFFF",
    ink: "#2E2640",
    muted: "#7A6F92",
    accent: "#7D5BC0",
    accentInk: "#FFFFFF",
    glow: "#DCCDF5",
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    bg: "#EDF4F8",
    surface: "#FFFFFF",
    ink: "#1E2E3C",
    muted: "#5E7384",
    accent: "#3A78AE",
    accentInk: "#FFFFFF",
    glow: "#C6DCEE",
  },
  cherry: {
    id: "cherry",
    label: "Cherry",
    bg: "#FFF0F1",
    surface: "#FFFFFF",
    ink: "#3A1418",
    muted: "#8C585D",
    accent: "#B0122E",
    accentInk: "#FFFFFF",
    glow: "#F6BFC7",
  },
  champagne: {
    id: "champagne",
    label: "Champagne",
    bg: "#FBF6EB",
    surface: "#FFFDF7",
    ink: "#3B3121",
    muted: "#857759",
    accent: "#A9823A",
    accentInk: "#FFFFFF",
    glow: "#EBDCB9",
  },
  latte: {
    id: "latte",
    label: "Latte",
    bg: "#F5EDE6",
    surface: "#FFFBF7",
    ink: "#392920",
    muted: "#83705F",
    accent: "#8A5A38",
    accentInk: "#FFFFFF",
    glow: "#E3CFBE",
  },
  noir: {
    id: "noir",
    label: "Noir & Gold",
    bg: "#141414",
    surface: "#1F1F1F",
    ink: "#F5EFE6",
    muted: "#A39C92",
    accent: "#D4AF6A",
    accentInk: "#141414",
    glow: "#3A3226",
  },
} as const satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

/** Every color theme, in display order. Templates offer all of them (see TEMPLATE_DEVELOPMENT.md). */
export const THEME_IDS = ["blush", "midnight", "sunset", "sage", "lavender", "ocean", "cherry", "champagne", "latte", "noir"] as const satisfies readonly ThemeId[];

export interface Font {
  id: string;
  label: string;
  /** Short description shown under the sample in the editor. */
  hint: string;
  /** CSS variable defined by next/font in `src/app/fonts.ts`. */
  cssVar: string;
  /** Size multiplier — script fonts look small at the same size, so they're scaled up. */
  scale?: number;
  italic?: boolean;
}

/**
 * Curated fonts. Story fonts are chosen for readability over several paragraphs
 * (serifs with a romantic feel, or soft rounded sans); final-message fonts are
 * expressive scripts and handwriting that still read well at display size.
 */
export const FONTS = {
  // Story text (titles + memories)
  lora: { id: "lora", label: "Lora", hint: "Storybook", cssVar: "--font-lora" },
  garamond: { id: "garamond", label: "EB Garamond", hint: "Classic", cssVar: "--font-garamond", scale: 1.06 },
  baskerville: { id: "baskerville", label: "Baskerville", hint: "Timeless", cssVar: "--font-baskerville", scale: 0.94 },
  cormorant: { id: "cormorant", label: "Cormorant", hint: "Romantic", cssVar: "--font-cormorant", scale: 1.1 },
  nunito: { id: "nunito", label: "Nunito", hint: "Soft", cssVar: "--font-nunito" },
  quicksand: { id: "quicksand", label: "Quicksand", hint: "Sweet", cssVar: "--font-quicksand" },
  // Final message
  great_vibes: { id: "great_vibes", label: "Great Vibes", hint: "Elegant script", cssVar: "--font-greatvibes", scale: 1.3 },
  parisienne: { id: "parisienne", label: "Parisienne", hint: "Parisian", cssVar: "--font-parisienne", scale: 1.15 },
  sacramento: { id: "sacramento", label: "Sacramento", hint: "Delicate", cssVar: "--font-sacramento", scale: 1.4 },
  dancing: { id: "dancing", label: "Dancing Script", hint: "Playful", cssVar: "--font-dancing", scale: 1.12 },
  caveat: { id: "caveat", label: "Caveat", hint: "Handwritten note", cssVar: "--font-caveat", scale: 1.2 },
  playfair_italic: { id: "playfair_italic", label: "Playfair", hint: "Classic italic", cssVar: "--font-playfair", italic: true },
} as const satisfies Record<string, Font>;

export type FontId = keyof typeof FONTS;

export const STORY_FONT_IDS = ["lora", "garamond", "baskerville", "cormorant", "nunito", "quicksand"] as const satisfies readonly FontId[];
export const FINAL_FONT_IDS = ["great_vibes", "parisienne", "sacramento", "dancing", "caveat", "playfair_italic"] as const satisfies readonly FontId[];

export interface Track {
  id: string;
  title: string;
  mood: "Romantic piano" | "Dreamy" | "Cute" | "Emotional" | "Celebration" | "Birthday";
  /** Path under /public. Files must be royalty-free / licensed for this use. */
  src: string;
  /** Where the license comes from — keep this accurate for every track. */
  license: string;
}

/**
 * Love, Written music library.
 *
 * Ships EMPTY on purpose: add only audio you own or that is licensed for commercial use
 * (see TEMPLATE_DEVELOPMENT.md → "Adding music"). While the library is empty the editor
 * hides music fields and renderers simply play nothing.
 *
 * Example entry:
 *   { id: "soft-piano", title: "Soft Piano", mood: "Romantic piano",
 *     src: "/music/soft-piano.mp3", license: "Composed for Love, Written (owned)" },
 */
export const MUSIC_LIBRARY: readonly Track[] = [];

/** A track id from MUSIC_LIBRARY. Validated against the library at runtime. */
export type TrackId = string;

export const NO_MUSIC = "none";

export function getTheme(id: string | undefined): Theme {
  return (THEMES as Record<string, Theme>)[id ?? ""] ?? THEMES.blush;
}

export function getFont(id: string | undefined, fallback: FontId = "lora"): Font {
  return (FONTS as Record<string, Font>)[id ?? ""] ?? FONTS[fallback];
}

export function getTrack(id: string | undefined): Track | undefined {
  return MUSIC_LIBRARY.find((t) => t.id === id);
}

/**
 * CSS custom properties a renderer can spread on its root element:
 * theme colors, the story font (--lw-story) and the final-message font (--lw-final).
 */
export function themeVars(theme: Theme, story: Font, final: Font): Record<string, string> {
  return {
    "--lw-bg": theme.bg,
    "--lw-surface": theme.surface,
    "--lw-ink": theme.ink,
    "--lw-muted": theme.muted,
    "--lw-accent": theme.accent,
    "--lw-accent-ink": theme.accentInk,
    "--lw-glow": theme.glow,
    "--lw-story": `var(${story.cssVar})`,
    "--lw-story-scale": String(story.scale ?? 1),
    "--lw-final": `var(${final.cssVar})`,
    "--lw-final-scale": String(final.scale ?? 1),
    "--lw-final-style": final.italic ? "italic" : "normal",
  };
}
