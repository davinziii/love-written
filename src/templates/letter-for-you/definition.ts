import { defineTemplate, type TemplateData } from "../types";
import { FINAL_FONT_IDS, STORY_FONT_IDS, THEME_IDS } from "../styles";

/**
 * A Letter for You — field schema.
 *
 * An envelope opens, a handwritten-style letter rises out, flowers burst up and
 * 10–12 photos scatter around it. Ten photos are required (the composition is designed
 * for ten); photos 11 and 12 are optional extras.
 */
const photo = (n: number, required: boolean) =>
  ({
    id: `photo_${n}`,
    type: "image",
    label: `Photo ${n}`,
    group: "Your Photos",
    required,
    ...(n === 1 ? { help: "Add 10 favorite photos of you two. Photos 11 and 12 are optional." } : {}),
  }) as const;

export const letterForYouDefinition = defineTemplate({
  id: "letter-for-you",
  name: "A Letter for You",
  tagline: "A love letter that opens into a collection of memories.",
  description:
    "They tap a sealed envelope. It opens, your handwritten-style letter rises out, flowers burst into the air and your favorite photos gather around it — like being surrounded by every memory you share.",
  category: "Romance · Anniversary · Just Because",
  schemaVersion: 1,
  listed: true,
  displayField: "recipient_name",
  highlights: [
    "A sealed envelope they open with a tap",
    "Your letter rises out as flowers burst up",
    "10–12 photos scattered around the letter",
    "Floating hearts, and taps make little hearts",
  ],
  fields: [
    // ── The Letter ─────────────────────────────────────────────────
    {
      id: "recipient_name",
      type: "text",
      label: "Their name",
      group: "The Letter",
      required: true,
      maxLength: 40,
      placeholder: "Samantha",
    },
    {
      id: "greeting",
      type: "text",
      label: "Greeting",
      group: "The Letter",
      help: "Shown before their name. Leave blank for “Dear”.",
      maxLength: 24,
      placeholder: "Dear",
    },
    {
      id: "letter_opening",
      type: "textarea",
      label: "Letter opening",
      group: "The Letter",
      required: true,
      maxLength: 400,
      rows: 3,
      placeholder: "I've been meaning to write this for a while…",
    },
    {
      id: "letter_body",
      type: "textarea",
      label: "Your letter",
      group: "The Letter",
      help: "The heart of it. Press Enter twice to start a new paragraph.",
      required: true,
      maxLength: 1500,
      rows: 7,
      placeholder: "Every photo here is a moment I'd live again…",
    },
    {
      id: "letter_closing",
      type: "textarea",
      label: "Letter closing",
      group: "The Letter",
      required: true,
      maxLength: 400,
      rows: 3,
      placeholder: "Thank you for every ordinary day that felt extraordinary with you.",
    },
    {
      id: "sign_off",
      type: "text",
      label: "Sign-off",
      group: "The Letter",
      help: "Leave blank for “With all my love,”.",
      maxLength: 40,
      placeholder: "With all my love,",
    },
    {
      id: "sender_name",
      type: "text",
      label: "Your name",
      group: "The Letter",
      required: true,
      maxLength: 40,
      placeholder: "Vinz",
    },

    // ── Photos ─────────────────────────────────────────────────────
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => photo(n, true)),
    photo(11, false),
    photo(12, false),

    // ── Look & Feel ────────────────────────────────────────────────
    {
      id: "theme",
      type: "color",
      label: "Color theme",
      group: "Look & Feel",
      help: "The scene slowly warms into this color after the envelope opens.",
      options: THEME_IDS,
      default: "blush",
    },
    {
      id: "story_font",
      type: "font",
      label: "Font style",
      group: "Look & Feel",
      help: "Used for the letter itself — chosen to stay easy to read.",
      options: STORY_FONT_IDS,
      default: "garamond",
      previewText: "My love,",
      picker: "dropdown",
    },
    {
      id: "final_font",
      type: "font",
      label: "Greeting font",
      group: "Look & Feel",
      help: "Used for the greeting and your signature.",
      options: FINAL_FONT_IDS,
      default: "parisienne",
      previewText: "Dear you",
    },
  ],
  sample: {
    recipient_name: "Samantha",
    greeting: "Dear",
    letter_opening: "I wanted to give you something you could open — so here's a letter, and a few of my favorite moments with you.",
    letter_body:
      "Every photo around this letter is a day I'd happily live again. The road trips where we got lost on purpose. The quiet coffees. The nights we talked until the sky turned pink.\n\nYou make ordinary days feel like the best part of my life, and I don't say it nearly enough.",
    letter_closing: "Thank you for choosing me, every single day. I'd choose you in every lifetime.",
    sign_off: "With all my love,",
    sender_name: "Vinz",
    photo_1: "/samples/memory-1.svg",
    photo_2: "/samples/letter-1.svg",
    photo_3: "/samples/memory-2.svg",
    photo_4: "/samples/letter-2.svg",
    photo_5: "/samples/letter-3.svg",
    photo_6: "/samples/memory-3.svg",
    photo_7: "/samples/letter-4.svg",
    photo_8: "/samples/letter-5.svg",
    photo_9: "/samples/letter-6.svg",
    photo_10: "/samples/letter-7.svg",
    photo_11: "/samples/letter-8.svg",
    photo_12: "/samples/letter-9.svg",
    theme: "blush",
    story_font: "garamond",
    final_font: "parisienne",
  },
});

export type LetterForYouData = TemplateData<typeof letterForYouDefinition.fields>;
