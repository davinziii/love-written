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
} as const satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

export interface Font {
  id: string;
  label: string;
  /** CSS variable defined by next/font in `src/app/fonts.ts`. */
  cssVar: string;
}

export const FONTS = {
  classic: { id: "classic", label: "Classic", cssVar: "--font-playfair" },
  romantic: { id: "romantic", label: "Romantic", cssVar: "--font-cormorant" },
  handwritten: { id: "handwritten", label: "Handwritten", cssVar: "--font-dancing" },
  modern: { id: "modern", label: "Modern Serif", cssVar: "--font-fraunces" },
  gentle: { id: "gentle", label: "Gentle", cssVar: "--font-lora" },
} as const satisfies Record<string, Font>;

export type FontId = keyof typeof FONTS;

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

export function getFont(id: string | undefined): Font {
  return (FONTS as Record<string, Font>)[id ?? ""] ?? FONTS.classic;
}

export function getTrack(id: string | undefined): Track | undefined {
  return MUSIC_LIBRARY.find((t) => t.id === id);
}

/** CSS custom properties a renderer can spread on its root element. */
export function themeVars(theme: Theme, font: Font): Record<string, string> {
  return {
    "--lw-bg": theme.bg,
    "--lw-surface": theme.surface,
    "--lw-ink": theme.ink,
    "--lw-muted": theme.muted,
    "--lw-accent": theme.accent,
    "--lw-accent-ink": theme.accentInk,
    "--lw-glow": theme.glow,
    "--lw-heading": `var(${font.cssVar})`,
  };
}
