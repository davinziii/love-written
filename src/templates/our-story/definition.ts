import { defineTemplate, type TemplateData } from "../types";
import { FINAL_FONT_IDS, MUSIC_LIBRARY, STORY_FONT_IDS } from "../styles";

/**
 * Our Story — the field schema.
 *
 * This file is the single source of truth for what a customer can fill in.
 * The generic editor builds its form from `fields`; the server validates against it;
 * `OurStoryRenderer` receives `OurStoryData`, which TypeScript derives from it.
 */
export const ourStoryDefinition = defineTemplate({
  id: "our-story",
  name: "Our Story",
  tagline: "Your favorite memories, told as a love story.",
  description:
    "A romantic, interactive story built from your photos and words. They open it like a letter, scroll through the moments that made you two, and end on a final reveal written just for them.",
  category: "Romance · Anniversary · Just Because",
  schemaVersion: 2,
  listed: true,
  displayField: "recipient_name",
  highlights: [
    "Opens like a sealed letter",
    "Up to three photo memories",
    "A final message they reveal with a tap",
    "Ten color themes, plus fonts for your story and final message",
  ],
  fields: [
    // ── The Opening ────────────────────────────────────────────────
    {
      id: "recipient_name",
      type: "text",
      label: "Their name",
      group: "The Opening",
      required: true,
      maxLength: 40,
      placeholder: "Samantha",
    },
    {
      id: "sender_name",
      type: "text",
      label: "Your name",
      group: "The Opening",
      help: "Shown as the signature at the end.",
      required: true,
      maxLength: 40,
      placeholder: "Vinz",
    },
    {
      id: "story_title",
      type: "text",
      label: "Story title",
      group: "The Opening",
      help: "Leave blank to use “Our Story”.",
      maxLength: 60,
      placeholder: "Our Story",
    },
    {
      id: "together_since",
      type: "date",
      label: "The day it all began",
      group: "The Opening",
      help: "Optional — we'll count the days you've had together.",
    },
    {
      id: "intro_message",
      type: "textarea",
      label: "Opening message",
      group: "The Opening",
      required: true,
      maxLength: 600,
      rows: 4,
      placeholder: "I wanted to make something just for you…",
    },

    // ── Memories ───────────────────────────────────────────────────
    {
      id: "memory_photo_1",
      type: "image",
      label: "First memory — photo",
      group: "Your Memories",
      required: true,
    },
    {
      id: "memory_1",
      type: "textarea",
      label: "First memory — what happened",
      group: "Your Memories",
      required: true,
      maxLength: 500,
      rows: 3,
      placeholder: "The night we got lost looking for that tiny ramen place…",
    },
    {
      id: "memory_date_1",
      type: "date",
      label: "First memory — date",
      group: "Your Memories",
    },
    {
      id: "memory_photo_2",
      type: "image",
      label: "Second memory — photo",
      group: "Your Memories",
    },
    {
      id: "memory_2",
      type: "textarea",
      label: "Second memory — what happened",
      group: "Your Memories",
      maxLength: 500,
      rows: 3,
    },
    {
      id: "memory_date_2",
      type: "date",
      label: "Second memory — date",
      group: "Your Memories",
    },
    {
      id: "memory_photo_3",
      type: "image",
      label: "Third memory — photo",
      group: "Your Memories",
    },
    {
      id: "memory_3",
      type: "textarea",
      label: "Third memory — what happened",
      group: "Your Memories",
      maxLength: 500,
      rows: 3,
    },
    {
      id: "memory_date_3",
      type: "date",
      label: "Third memory — date",
      group: "Your Memories",
    },

    // ── The Final Reveal ───────────────────────────────────────────
    {
      id: "final_message",
      type: "textarea",
      label: "Final message",
      group: "The Final Reveal",
      help: "Revealed last, when they tap the heart.",
      required: true,
      maxLength: 800,
      rows: 5,
      placeholder: "Out of everyone in the world, I'd still choose you…",
    },
    {
      id: "final_font",
      type: "font",
      label: "Final message font",
      group: "The Final Reveal",
      help: "Only the final message and your signature use this font.",
      options: FINAL_FONT_IDS,
      default: "great_vibes",
      previewText: "I love you",
    },

    // ── Look & Feel (style) ────────────────────────────────────────
    {
      id: "theme",
      type: "color",
      label: "Color theme",
      group: "Look & Feel",
      options: ["blush", "midnight", "sunset", "sage", "lavender", "ocean", "cherry", "champagne", "latte", "noir"],
      default: "blush",
    },
    {
      id: "story_font",
      type: "font",
      label: "Story font",
      group: "Look & Feel",
      help: "Used for the titles and every memory.",
      options: STORY_FONT_IDS,
      default: "lora",
      previewText: "Our Story",
    },
    {
      id: "music",
      type: "music",
      label: "Background music",
      group: "Look & Feel",
      help: "Optional. Plays after they open the story.",
      options: MUSIC_LIBRARY.map((t) => t.id),
    },
  ],
  sample: {
    recipient_name: "Samantha",
    sender_name: "Vinz",
    story_title: "Our Story",
    together_since: "2022-02-14",
    intro_message:
      "I wanted to make something that holds a few of my favorite moments with you — the small ones and the big ones. Scroll slowly.",
    memory_photo_1: "/samples/memory-1.svg",
    memory_1:
      "The evening we watched the sun go down and forgot to take a single photo until it was almost gone. I think that's when I knew.",
    memory_date_1: "2022-02-14",
    memory_photo_2: "/samples/memory-2.svg",
    memory_2: "Getting lost in the city on purpose. You navigated, I carried the snacks. Perfect team.",
    memory_date_2: "2023-06-03",
    memory_photo_3: "/samples/memory-3.svg",
    memory_3: "Every quiet Sunday morning since. My favorite place is wherever you are.",
    final_message:
      "Out of everyone in the world, I'd still choose you — every single time. Happy anniversary, my love.",
    theme: "blush",
    story_font: "lora",
    final_font: "great_vibes",
    music: "none",
  },
});

export type OurStoryData = TemplateData<typeof ourStoryDefinition.fields>;
