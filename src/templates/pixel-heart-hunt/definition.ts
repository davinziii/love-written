import { defineTemplate, type TemplateData } from "../types";
import { STORY_FONT_IDS } from "../styles";

/**
 * Pixel Heart Hunt — field schema.
 *
 * A little pixel-art arcade game: they aim a cupid's bow and shoot five floating hearts.
 * Every heart unlocks one of your photos with a caption, the fifth unlocks a secret love
 * letter in a pixel envelope, and "Keep playing" turns it into an endless heart-popping game.
 *
 * The pixel look is fixed (pastel arcade), so instead of the color themes Look & Feel offers
 * the game's own palettes, the game title and the letter font.
 */
export const MEMORY_COUNT = 5;

export const PALETTES = [
  {
    id: "strawberry",
    label: "Strawberry milk",
    hint: "Pastel pink with raspberry hearts",
    swatch: "#F3B7CE",
    colors: { bg: "#F8DFE8", bgLow: "#F3C9DA", soft: "#F3B7CE", heart: "#D94F80", heartDark: "#923A61", accent: "#C6B7E9", cream: "#FFF5E8", ink: "#713B59", paperInk: "#713B59", star: "#FFFFFF" },
  },
  {
    id: "lavender",
    label: "Lavender dream",
    hint: "Soft lilac sky, pink hearts",
    swatch: "#C6B7E9",
    colors: { bg: "#E6DEF6", bgLow: "#D6CBF0", soft: "#C6B7E9", heart: "#D94F80", heartDark: "#8A3A63", accent: "#F3B7CE", cream: "#FFF7EE", ink: "#5B3F72", paperInk: "#5B3F72", star: "#FFFFFF" },
  },
  {
    id: "night",
    label: "Midnight arcade",
    hint: "A starry night with glowing hearts",
    swatch: "#2B2347",
    colors: { bg: "#2B2347", bgLow: "#3B2F5E", soft: "#5A4A85", heart: "#FF6F9F", heartDark: "#B33B6A", accent: "#9C86D9", cream: "#FFF5E8", ink: "#FBE6F0", paperInk: "#5B3F72", star: "#FFE9A8" },
  },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];
export type Palette = (typeof PALETTES)[number]["colors"];

const DEFAULT_CAPTIONS = [
  "You make ordinary days special.",
  "My favorite memories are with you.",
  "Every adventure is better together.",
  "You're my favorite person.",
  "And my favorite story is us.",
];

const memory = (n: number) =>
  [
    // Photo + caption right after it = one row in the editor (photo beside its text box).
    {
      id: `memory_photo_${n}`,
      type: "image",
      label: `Heart ${n} photo`,
      group: "Five Hearts, Five Photos",
      required: true,
      ...(n === 1 ? { help: "Each heart they hit unlocks the next photo, in this order." } : {}),
    },
    {
      id: `memory_caption_${n}`,
      type: "textarea",
      label: `Heart ${n} — caption`,
      group: "Five Hearts, Five Photos",
      required: true,
      maxLength: 160,
      rows: 2,
      placeholder: DEFAULT_CAPTIONS[n - 1],
    },
  ] as const;

export const pixelHeartHuntDefinition = defineTemplate({
  id: "pixel-heart-hunt",
  name: "Pixel Heart Hunt",
  tagline: "A tiny pixel game that ends in a love letter.",
  description:
    "A charming pixel-art arcade game made just for them. They aim a little cupid's bow and shoot five floating hearts — every heart unlocks one of your photos and a few words from you. Collect all five and a pixel envelope appears with your secret love letter inside. Then they can keep popping hearts for as long as they like.",
  category: "Romance · Anniversary · Birthday · Just Because",
  schemaVersion: 1,
  listed: true,
  displayField: "recipient_name",
  bulkPhotos: {
    label: "Add all five photos at once",
    help: "Choose five photos in one go — heart 1 unlocks the first, heart 5 the last. You can replace any of them below.",
    fieldIds: Array.from({ length: MEMORY_COUNT }, (_, i) => `memory_photo_${i + 1}`),
  },
  highlights: [
    "A real little game: aim, shoot, and pop five pixel hearts",
    "Every heart unlocks one of your photos with your caption",
    "All five unlock a secret love letter in a pixel envelope",
    "Endless heart-popping mode once they've read it",
    "Made for phones — big buttons, or just tap where to shoot",
  ],
  fields: [
    // ── Look & Feel (always first — see TEMPLATE_DEVELOPMENT.md) ──
    {
      id: "palette",
      type: "choice",
      label: "Game colors",
      group: "Look & Feel",
      options: PALETTES.map((p) => ({ id: p.id, label: p.label, hint: p.hint, swatch: p.swatch })),
      default: "strawberry",
    },
    {
      id: "game_title",
      type: "text",
      label: "Game title",
      group: "Look & Feel",
      help: "Shown at the top of the game. Leave empty for “Heart Hunt”.",
      maxLength: 18,
      placeholder: "Heart Hunt",
    },
    {
      id: "letter_font",
      type: "font",
      label: "Letter font",
      group: "Look & Feel",
      options: STORY_FONT_IDS,
      default: "nunito",
      previewText: "To my favorite",
    },

    // ── The players ──
    { id: "recipient_name", type: "text", label: "Their name", group: "The Players", required: true, maxLength: 40, placeholder: "My Love" },
    { id: "sender_name", type: "text", label: "Your name", group: "The Players", required: true, maxLength: 40, placeholder: "Your Favorite Person" },
    {
      id: "intro_text",
      type: "text",
      label: "Opening line",
      group: "The Players",
      help: "The first thing they see. Leave empty for “Someone sent you a little love…”.",
      maxLength: 60,
      placeholder: "Someone sent you a little love...",
    },

    ...memory(1),
    ...memory(2),
    ...memory(3),
    ...memory(4),
    ...memory(5),

    // ── The secret letter ──
    {
      id: "letter_title",
      type: "text",
      label: "Letter greeting",
      group: "The Secret Letter",
      help: "Leave empty for “To my favorite person,”.",
      maxLength: 60,
      placeholder: "To my favorite person,",
    },
    {
      id: "letter_message",
      type: "textarea",
      label: "Your love letter",
      group: "The Secret Letter",
      required: true,
      maxLength: 2500,
      rows: 8,
      placeholder: "If I could collect every little moment that made me smile, so many of them would lead back to you…",
    },
    {
      id: "letter_signature",
      type: "text",
      label: "Closing",
      group: "The Secret Letter",
      help: "Signed above your name. Leave empty for “Love, always ♡”.",
      maxLength: 40,
      placeholder: "Love, always ♡",
    },
  ],
  sample: {
    palette: "strawberry",
    letter_font: "nunito",
    game_title: "Heart Hunt",
    recipient_name: "My Love",
    sender_name: "Your Favorite Person",
    memory_photo_1: "/samples/memory-1.svg",
    memory_caption_1: DEFAULT_CAPTIONS[0]!,
    memory_photo_2: "/samples/letter-2.svg",
    memory_caption_2: DEFAULT_CAPTIONS[1]!,
    memory_photo_3: "/samples/memory-2.svg",
    memory_caption_3: DEFAULT_CAPTIONS[2]!,
    memory_photo_4: "/samples/letter-5.svg",
    memory_caption_4: DEFAULT_CAPTIONS[3]!,
    memory_photo_5: "/samples/memory-3.svg",
    memory_caption_5: DEFAULT_CAPTIONS[4]!,
    letter_title: "To my favorite person,",
    letter_message:
      "If I could collect every little moment that made me smile, so many of them would lead back to you.\n\nThank you for being part of my happiest memories, my favorite adventures, and all the beautiful ordinary days in between.\n\nIf love were a game, I'd choose you in every lifetime.",
    letter_signature: "Love, always ♡",
  },
});

export type PixelHeartHuntData = TemplateData<typeof pixelHeartHuntDefinition.fields>;

export function getPalette(id: string | undefined): Palette {
  return (PALETTES.find((p) => p.id === id) ?? PALETTES[0]).colors;
}
