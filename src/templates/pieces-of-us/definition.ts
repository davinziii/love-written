import { defineTemplate, type TemplateData } from "../types";
import { STORY_FONT_IDS } from "../styles";

/**
 * Pieces of Us — field schema.
 *
 * A scrapbook with a real jigsaw puzzle inside: a sealed invitation, then one to three of
 * your photos cut into interlocking pieces. Each finished photo becomes a Polaroid with your
 * caption and a hidden message on the back; the last one leads to a golden "missing piece"
 * and your love letter.
 *
 * The scrapbook has its own three palettes (Look & Feel → Colors) instead of the shared themes.
 */
export const MAX_PUZZLES = 3;

export const THEMES = [
  {
    id: "strawberry",
    label: "Strawberry Love",
    hint: "Blush, cream and cherry pink",
    swatch: "#E75B73",
    colors: { desk: "#F8DDE3", deskDeep: "#F1C9D2", paper: "#FFF8EE", accent: "#E75B73", accentDeep: "#A94D5B", ink: "#5B4149", tape: "#F6B9C6", gold: "#E8B84A" },
  },
  {
    id: "vintage",
    label: "Vintage Romance",
    hint: "Ivory, burgundy and antique rose",
    swatch: "#7E2639",
    colors: { desk: "#EFE4D2", deskDeep: "#E3D3BA", paper: "#FFFBF2", accent: "#B9606F", accentDeep: "#7E2639", ink: "#4A3530", tape: "#D9C08A", gold: "#C9A04A" },
  },
  {
    id: "lavender",
    label: "Lavender Dreams",
    hint: "Lilac, cream and muted violet",
    swatch: "#8E72B8",
    colors: { desk: "#E9E1F4", deskDeep: "#DBCFEC", paper: "#FFFAF3", accent: "#A786D2", accentDeep: "#6B5394", ink: "#463C57", tape: "#CDBCE6", gold: "#D9B456" },
  },
] as const;

export type ThemeColors = (typeof THEMES)[number]["colors"];

export const DIFFICULTIES = [
  { id: "4", label: "Sweet & Simple", n: 4 },
  { id: "5", label: "Little Challenge", n: 5 },
  { id: "6", label: "Love Puzzle", n: 6 },
  { id: "7", label: "Heartbreaker", n: 7 },
  { id: "8", label: "Puzzle Master", n: 8 },
] as const;

const DEFAULT_CAPTIONS = ["The day it all started", "Our favorite adventure", "Us, always"];
const DEFAULT_MESSAGES = [
  "I still remember how nervous I was. I'd do it all over again.",
  "Getting lost is my favorite thing to do — as long as it's with you.",
  "Every ordinary day with you is my favorite kind of day.",
];

const memory = (n: number) => {
  const group = `Memory ${n}`;
  const optional = n > 1 ? ` Only used when you choose ${n} or more puzzles.` : "";
  return [
    // Photo + message right after it = one row in the editor (photo beside its text box).
    {
      id: `memory_photo_${n}`,
      type: "image",
      label: `Puzzle ${n} photo`,
      group,
      required: n === 1,
      help: `This photo is cut into puzzle pieces.${optional}`,
    },
    {
      id: `memory_message_${n}`,
      type: "textarea",
      label: `Memory ${n} — hidden message`,
      group,
      maxLength: 400,
      rows: 3,
      placeholder: DEFAULT_MESSAGES[n - 1],
    },
    {
      id: `memory_caption_${n}`,
      type: "text",
      label: `Memory ${n} caption`,
      group,
      maxLength: 50,
      placeholder: DEFAULT_CAPTIONS[n - 1],
      help: "Written under the Polaroid. The hidden message is on its back.",
    },
  ] as const;
};

export const piecesOfUsDefinition = defineTemplate({
  id: "pieces-of-us",
  name: "Pieces of Us",
  tagline: "Some memories are worth putting back together.",
  description:
    "A handmade scrapbook with a real jigsaw puzzle inside. They open your invitation and piece your favorite photos back together — each finished photo turns into a Polaroid with a hidden message on the back. After the last one, a single golden piece is still missing… and it unlocks your love letter.",
  category: "Romance · Anniversary · Birthday · Just Because",
  schemaVersion: 1,
  listed: true,
  priceCentavos: 14900,
  collection: "games",
  displayField: "recipient_name",
  bulkPhotos: {
    label: "Add your puzzle photos at once",
    help: "Choose up to three photos — each becomes one puzzle, in order.",
    fieldIds: Array.from({ length: MAX_PUZZLES }, (_, i) => `memory_photo_${i + 1}`),
  },
  highlights: [
    "A real jigsaw puzzle with interlocking pieces — made from your photos",
    "1 to 3 puzzles, from an easy 4 × 4 up to a 64-piece 8 × 8",
    "Each finished photo becomes a Polaroid with a hidden message",
    "A golden missing piece that unlocks your love letter",
    "Drag, or tap a piece and tap its spot — made for phones",
  ],
  fields: [
    // ── Look & Feel (always first — see TEMPLATE_DEVELOPMENT.md) ──
    {
      id: "theme",
      type: "choice",
      label: "Colors",
      group: "Look & Feel",
      options: THEMES.map((t) => ({ id: t.id, label: t.label, hint: t.hint, swatch: t.swatch })),
      default: "strawberry",
    },
    {
      id: "letter_font",
      type: "font",
      label: "Letter font",
      group: "Look & Feel",
      options: STORY_FONT_IDS,
      default: "lora",
      previewText: "I scattered a few",
    },

    // ── The invitation ──
    { id: "recipient_name", type: "text", label: "Their name", group: "The Invitation", required: true, maxLength: 40, placeholder: "Sam" },
    { id: "sender_name", type: "text", label: "Your name", group: "The Invitation", required: true, maxLength: 40, placeholder: "Alex" },
    {
      id: "invitation_message",
      type: "textarea",
      label: "Invitation message",
      group: "The Invitation",
      maxLength: 240,
      rows: 3,
      help: "Written inside the envelope they open first. Leave empty for the example.",
      placeholder: "I scattered a few of my favorite memories. Will you help me put them back together?",
    },

    // ── The puzzles ──
    {
      id: "puzzle_count",
      type: "choice",
      label: "How many puzzles",
      group: "The Puzzles",
      options: [
        { id: "1", label: "1 puzzle", hint: "One photo to put back together" },
        { id: "2", label: "2 puzzles", hint: "Two photos, one after the other" },
        { id: "3", label: "3 puzzles", hint: "Three photos, one after the other" },
      ],
      default: "3",
      help: "Add a photo below for each puzzle.",
    },
    {
      id: "difficulty",
      type: "choice",
      label: "Difficulty",
      group: "The Puzzles",
      options: DIFFICULTIES.map((d) => ({ id: d.id, label: d.label, hint: `${d.n} × ${d.n} · ${d.n * d.n} pieces`, grid: [d.n, d.n] as const })),
      default: "5",
      gridPreview: { imageField: "memory_photo_1" },
      help: "Every photo is cut the same way. 7 × 7 and 8 × 8 can be zoomed on phones.",
    },

    ...memory(1),
    ...memory(2),
    ...memory(3),

    // ── The final surprise ──
    {
      id: "letter_greeting",
      type: "text",
      label: "Letter greeting",
      group: "The Final Surprise",
      maxLength: 60,
      placeholder: "My love,",
      help: "Leave empty for “My love,”.",
    },
    {
      id: "letter_message",
      type: "textarea",
      label: "Your love letter",
      group: "The Final Surprise",
      required: true,
      maxLength: 2500,
      rows: 8,
      placeholder: "Thank you for every piece of us…",
    },
    {
      id: "letter_signature",
      type: "text",
      label: "Closing",
      group: "The Final Surprise",
      maxLength: 40,
      placeholder: "Forever yours,",
      help: "Signed above your name. Leave empty for “Forever yours,”.",
    },
  ],
  sample: {
    theme: "strawberry",
    letter_font: "lora",
    recipient_name: "Sam",
    sender_name: "Alex",
    invitation_message: "I scattered a few of my favorite memories. Will you help me put them back together?",
    puzzle_count: "3",
    difficulty: "4",
    memory_photo_1: "/samples/memory-1.svg",
    memory_caption_1: DEFAULT_CAPTIONS[0]!,
    memory_message_1: DEFAULT_MESSAGES[0]!,
    memory_photo_2: "/samples/memory-2.svg",
    memory_caption_2: DEFAULT_CAPTIONS[1]!,
    memory_message_2: DEFAULT_MESSAGES[1]!,
    memory_photo_3: "/samples/memory-3.svg",
    memory_caption_3: DEFAULT_CAPTIONS[2]!,
    memory_message_3: DEFAULT_MESSAGES[2]!,
    letter_greeting: "My love,",
    letter_message:
      "Thank you for every piece of us — the big moments and the tiny, ordinary ones that somehow matter most.\n\nLife with you feels like a picture I never want to finish looking at. Some days we're scattered, and that's okay. We always find our way back together.\n\nHere's to all the memories we haven't made yet.",
    letter_signature: "Forever yours,",
  },
});

export type PiecesOfUsData = TemplateData<typeof piecesOfUsDefinition.fields>;

export function getThemeColors(id: string | undefined): ThemeColors {
  return (THEMES.find((t) => t.id === id) ?? THEMES[0]).colors;
}

export function gridSize(id: string | undefined): number {
  return (DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]).n;
}
