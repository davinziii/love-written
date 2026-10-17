import { defineTemplate, type ChoiceOption, type TemplateData } from "../types";
import { FINAL_FONT_IDS } from "../styles";
import { BACKGROUNDS, DEFAULT_BACKGROUND, DEFAULT_WORD_COLOR, WORD_COLORS } from "./palette";

/**
 * Journal — field schema.
 *
 * A photo journal shown as a fan of pages. Every page is one full photo (cropped to fill
 * the page, so portrait photos work too), with up to two extra photos pinned on top in white
 * frames and optional words in a color the customer picks for that photo.
 * Pages turn like the stiff pages of a hardcover book.
 */
export const PAGE_COUNT = 12;
export const REQUIRED_PAGES = 4;

const wordColorOptions: ChoiceOption[] = WORD_COLORS.map((c) => ({
  id: c.id,
  label: c.label,
  swatch: c.value,
  ...("hint" in c ? { hint: c.hint } : {}),
}));

const PLACEHOLDERS = [
  "Where it all started.",
  "That view, that day, you.",
  "Lost on purpose.",
  "My favorite kind of ordinary.",
  "Sunsets look better with you.",
  "Still my favorite adventure.",
  "Us, again and again.",
  "Lost in you.",
  "Little moments, big love.",
  "Our favorite place.",
  "Here's to forever.",
  "To be continued…",
];

const page = (n: number) =>
  [
    // Photo + words right after it = one row in the editor (photo beside its text box).
    {
      id: `page_photo_${n}`,
      type: "image",
      label: `Page ${n} photo`,
      group: `Page ${n}`,
      required: n <= REQUIRED_PAGES,
      ...(n === 1 ? { help: "Fills the whole page." } : {}),
    },
    {
      id: `page_words_${n}`,
      type: "textarea",
      label: "Words on this page",
      group: `Page ${n}`,
      maxLength: 140,
      rows: 3,
      placeholder: PLACEHOLDERS[n - 1],
    },
    {
      id: `page_words_color_${n}`,
      type: "choice",
      label: "Words color",
      group: `Page ${n}`,
      help: n === 1 ? "Pick what's easiest to read on this photo — white for darker photos, black or navy for bright ones." : undefined,
      options: wordColorOptions,
      default: DEFAULT_WORD_COLOR,
    },
    // Two photos in a row = tiles side by side in the editor.
    {
      id: `page_extra_${n}_1`,
      type: "image",
      label: "Extra photo",
      group: `Page ${n}`,
      help: n === 1 ? "Optional. Pinned on top of the page in a white frame." : undefined,
    },
    { id: `page_extra_${n}_2`, type: "image", label: "Extra photo", group: `Page ${n}` },
  ] as const;

export const journalDefinition = defineTemplate({
  id: "journal",
  name: "Journal",
  tagline: "Your memories, page by page.",
  description:
    "A photo journal of the two of you. Your pages fan out on both sides, and every swipe turns one over like a stiff hardcover page — each page a full photo, with little framed extras pinned on top and a few words wherever you want them.",
  category: "Romance · Anniversary · Travel · Just Because",
  schemaVersion: 1,
  listed: true,
  displayField: "journal_title",
  highlights: [
    "Pages that turn like a real hardcover book",
    "4 to 12 pages, each a full photo",
    "Up to two extra framed photos per page",
    "Optional words on any page, in the color you choose",
  ],
  fields: [
    // ── Look & Feel (always first — see TEMPLATE_DEVELOPMENT.md) ──
    {
      id: "background",
      type: "choice",
      label: "Background",
      group: "Look & Feel",
      options: BACKGROUNDS.map((b) => ({ id: b.id, label: b.label, swatch: `linear-gradient(${b.top}, ${b.bottom})` })),
      default: DEFAULT_BACKGROUND,
    },
    {
      id: "words_font",
      type: "font",
      label: "Words font",
      group: "Look & Feel",
      help: "Used for the words on every page.",
      options: FINAL_FONT_IDS,
      default: "caveat",
      previewText: "Where it all started.",
    },
    {
      id: "journal_title",
      type: "text",
      label: "Journal title",
      group: "Look & Feel",
      help: "Shown above the pages. Leave empty for “Journal”.",
      maxLength: 30,
      placeholder: "Journal",
    },

    ...page(1),
    ...page(2),
    ...page(3),
    ...page(4),
    ...page(5),
    ...page(6),
    ...page(7),
    ...page(8),
    ...page(9),
    ...page(10),
    ...page(11),
    ...page(12),
  ],
  sample: {
    background: "dusk",
    words_font: "caveat",
    journal_title: "Our Journal",
    page_photo_1: "/samples/memory-2.svg",
    page_extra_1_1: "/samples/letter-2.svg",
    page_extra_1_2: "/samples/letter-5.svg",
    page_words_1: "Where it all started.",
    page_words_color_1: "white",
    page_photo_2: "/samples/letter-1.svg",
    page_words_2: "That view, that day, you.",
    page_words_color_2: "navy",
    page_photo_3: "/samples/memory-1.svg",
    page_extra_3_1: "/samples/letter-8.svg",
    page_words_color_3: "white",
    page_photo_4: "/samples/letter-4.svg",
    page_extra_4_1: "/samples/memory-3.svg",
    page_extra_4_2: "/samples/letter-9.svg",
    page_words_4: "My favorite kind of ordinary.",
    page_words_color_4: "black",
    page_photo_5: "/samples/letter-7.svg",
    page_words_5: "Sunsets look better with you.",
    page_words_color_5: "black",
    page_photo_6: "/samples/letter-3.svg",
    page_extra_6_1: "/samples/letter-6.svg",
    page_words_color_6: "white",
    page_photo_7: "/samples/letter-6.svg",
    page_words_7: "Us, again and again.",
    page_words_color_7: "white",
    page_photo_8: "/samples/letter-5.svg",
    page_extra_8_1: "/samples/letter-2.svg",
    page_words_color_8: "white",
  },
});

export type JournalData = TemplateData<typeof journalDefinition.fields>;
