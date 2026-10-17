import { defineTemplate, type TemplateData } from "../types";

/**
 * CD Collection — field schema.
 *
 * A row of real-looking CD jewel cases standing in a studio; every photo is the cover of
 * one CD. Hover (or tap) a case to pull it out of the row; click (or tap again) to open its
 * memory. The collection zooms itself to fit however many CDs there are.
 */
export const MAX_CDS = 30;
export const MIN_CDS = 8;

export const BACKGROUNDS = [
  { id: "studio", label: "Studio gray", value: "#d0d0d0", dark: false },
  { id: "warm", label: "Warm gray", value: "#d6d0c8", dark: false },
  { id: "soft", label: "Soft white", value: "#e9e9e9", dark: false },
  { id: "blush", label: "Blush", value: "#e7d4d3", dark: false },
  { id: "night", label: "Night", value: "#25272d", dark: true },
] as const;

const cd = (n: number) => {
  const group = n <= 10 ? "CDs 1–10" : n <= 20 ? "CDs 11–20" : "CDs 21–30";
  return [
    // Photo + message right after it = one row in the editor (photo beside its text box).
    {
      id: `cd_photo_${n}`,
      type: "image",
      label: `CD ${n} cover`,
      group,
      required: n <= MIN_CDS,
      ...(n === 1 ? { help: `The photo becomes the CD's cover. At least ${MIN_CDS} CDs, up to ${MAX_CDS}.` } : {}),
    },
    {
      id: `cd_message_${n}`,
      type: "textarea",
      label: `CD ${n} — message`,
      group,
      maxLength: 400,
      rows: 3,
      ...(n === 1 ? { placeholder: "The beginning of our favorite story." } : {}),
    },
    {
      id: `cd_title_${n}`,
      type: "text",
      label: `CD ${n} title`,
      group,
      maxLength: 40,
      ...(n === 1 ? { placeholder: "Our First Date", help: "Shown when the CD is opened. Empty titles become “Track 1”, “Track 2”…" } : {}),
    },
  ] as const;
};

export const cdCollectionDefinition = defineTemplate({
  id: "cd-collection",
  name: "CD Collection",
  tagline: "Your memories as a shelf of CDs.",
  description:
    "Your photos become the covers of a whole collection of CDs, lined up in a long row like a real music shelf. They pull one out to look closer, then open it to read the memory and message behind it.",
  category: "Romance · Anniversary · Birthday · Just Because",
  schemaVersion: 1,
  listed: true,
  displayField: "collection_title",
  highlights: [
    `${MIN_CDS} to ${MAX_CDS} CDs, each with your photo as the cover`,
    "Hover or tap a CD to pull it out of the row",
    "Every CD opens a memory with your title and message",
    "The collection sizes itself to fit any number of CDs",
  ],
  fields: [
    // ── Look & Feel (always first — see TEMPLATE_DEVELOPMENT.md) ──
    {
      id: "background",
      type: "choice",
      label: "Background",
      group: "Look & Feel",
      options: BACKGROUNDS.map((b) => ({ id: b.id, label: b.label, swatch: b.value })),
      default: "studio",
    },
    {
      id: "collection_title",
      type: "text",
      label: "Collection title",
      group: "Look & Feel",
      help: "Shown in the corner. Leave empty for “Our Memories”.",
      maxLength: 40,
      placeholder: "Our Memories",
    },

    ...cd(1),
    ...cd(2),
    ...cd(3),
    ...cd(4),
    ...cd(5),
    ...cd(6),
    ...cd(7),
    ...cd(8),
    ...cd(9),
    ...cd(10),
    ...cd(11),
    ...cd(12),
    ...cd(13),
    ...cd(14),
    ...cd(15),
    ...cd(16),
    ...cd(17),
    ...cd(18),
    ...cd(19),
    ...cd(20),
    ...cd(21),
    ...cd(22),
    ...cd(23),
    ...cd(24),
    ...cd(25),
    ...cd(26),
    ...cd(27),
    ...cd(28),
    ...cd(29),
    ...cd(30),
  ],
  sample: {
    background: "studio",
    collection_title: "Our Memories",
    cd_photo_1: "/samples/memory-1.svg",
    cd_title_1: "Our First Date",
    cd_message_1: "The beginning of our favorite story.",
    cd_photo_2: "/samples/letter-1.svg",
    cd_title_2: "Our First Adventure",
    cd_message_2: "Every adventure is better with you.",
    cd_photo_3: "/samples/memory-2.svg",
    cd_title_3: "Our Favorite Day",
    cd_message_3: "A moment I will always remember.",
    cd_photo_4: "/samples/letter-2.svg",
    cd_message_4: "Coffee, rain, and you.",
    cd_photo_5: "/samples/letter-3.svg",
    cd_message_5: "The best birthday yet.",
    cd_photo_6: "/samples/memory-3.svg",
    cd_message_6: "Lazy Sundays are our thing.",
    cd_photo_7: "/samples/letter-4.svg",
    cd_message_7: "Still my favorite view.",
    cd_photo_8: "/samples/letter-5.svg",
    cd_message_8: "Us, on repeat.",
    cd_photo_9: "/samples/letter-6.svg",
    cd_message_9: "Picnics and long talks.",
    cd_photo_10: "/samples/letter-7.svg",
    cd_message_10: "Cake for breakfast, once.",
    cd_photo_11: "/samples/letter-8.svg",
    cd_message_11: "Road trip playlist on loop.",
    cd_photo_12: "/samples/letter-9.svg",
    cd_message_12: "Here's to the next track.",
  },
});

export type CdCollectionData = TemplateData<typeof cdCollectionDefinition.fields>;
