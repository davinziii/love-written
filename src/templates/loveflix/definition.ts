import { defineTemplate, type TemplateData } from "../types";

/**
 * Loveflix — field schema.
 *
 * A streaming-service style love story: a cinematic logo intro, a "Who's watching?"
 * profile screen, then a title page with a hero photo and a "Trending Now" row of five
 * memories that open in a full-screen viewer.
 *
 * The look is fixed (black, red, white), so unlike the other templates there is no
 * color theme or font choice — Look & Feel holds the photo mode and the logo text.
 */
const memory = (n: number, title: string, message: string) =>
  [
    // Photo + message right after it = one "memory" row in the editor; the title follows.
    { id: `memory_photo_${n}`, type: "image", label: `Memory ${n} photo`, group: "Trending Now", required: true },
    {
      id: `memory_message_${n}`,
      type: "textarea",
      label: `Memory ${n} — message`,
      group: "Trending Now",
      required: true,
      maxLength: 600,
      rows: 3,
      placeholder: message,
    },
    {
      id: `memory_title_${n}`,
      type: "text",
      label: `Memory ${n} title`,
      group: "Trending Now",
      maxLength: 40,
      placeholder: title,
      ...(n === 1 ? { help: "Shown above the message when it opens. Empty titles become “Episode 1”, “Episode 2”…" } : {}),
    },
  ] as const;

export const loveflixDefinition = defineTemplate({
  id: "loveflix",
  name: "Loveflix",
  tagline: "Your love story, streaming now.",
  description:
    "Your relationship as the #1 show on their screen. A cinematic logo intro, a “Who's watching?” screen with your four profiles, then your love story's title page — with five favorite memories they open one by one, each with your message.",
  category: "Romance · Anniversary · Just Because",
  schemaVersion: 1,
  listed: true,
  priceCentavos: 19900,
  collection: "photos",
  displayField: "show_title",
  highlights: [
    "A cinematic logo intro with your own logo text",
    "“Who's watching?” with four profiles you name",
    "Your story as today's Top 10 title",
    "Five memories that open full screen with your message",
    "Black & white or full-color photos",
  ],
  fields: [
    // ── Look & Feel (always first — see TEMPLATE_DEVELOPMENT.md) ──
    {
      id: "photo_mode",
      type: "choice",
      label: "Photo colors",
      group: "Look & Feel",
      help: "Applies to every photo except the profile pictures.",
      options: [
        { id: "grayscale", label: "Black & white", hint: "Cinematic, like the classic look" },
        { id: "color", label: "Original colors", hint: "Your photos exactly as they are" },
      ],
      default: "grayscale",
    },
    {
      id: "logo_text",
      type: "text",
      label: "Logo text",
      group: "Look & Feel",
      help: "The red logo in the intro and at the top. Leave empty for LOVEFLIX — or make it yours, like “SAMFLIX”.",
      maxLength: 12,
      placeholder: "LOVEFLIX",
    },

    // ── Who's Watching ─────────────────────────────────────────────
    {
      id: "profile_name_1",
      type: "text",
      label: "Profile 1 name",
      group: "Who's Watching",
      help: "The four profiles on the “Who's watching?” screen. Empty names use You, Me, Us and Forever.",
      maxLength: 14,
      placeholder: "You",
    },
    { id: "profile_name_2", type: "text", label: "Profile 2 name", group: "Who's Watching", maxLength: 14, placeholder: "Me" },
    { id: "profile_name_3", type: "text", label: "Profile 3 name", group: "Who's Watching", maxLength: 14, placeholder: "Us" },
    { id: "profile_name_4", type: "text", label: "Profile 4 name", group: "Who's Watching", maxLength: 14, placeholder: "Forever" },

    // A group of only photos becomes a grid of tiles in the editor.
    { id: "profile_photo_1", type: "image", label: "Profile 1", group: "Profile Pictures" },
    { id: "profile_photo_2", type: "image", label: "Profile 2", group: "Profile Pictures" },
    { id: "profile_photo_3", type: "image", label: "Profile 3", group: "Profile Pictures" },
    { id: "profile_photo_4", type: "image", label: "Profile 4", group: "Profile Pictures" },

    // ── The Show ───────────────────────────────────────────────────
    {
      id: "show_title",
      type: "text",
      label: "Title",
      group: "Your Show",
      required: true,
      maxLength: 40,
      placeholder: "Our Love Story",
    },
    {
      id: "show_subtitle",
      type: "text",
      label: "Line under the title",
      group: "Your Show",
      maxLength: 50,
      placeholder: "Today's Top 10 Love Stories",
    },
    {
      id: "show_description",
      type: "textarea",
      label: "Description",
      group: "Your Show",
      required: true,
      maxLength: 260,
      rows: 4,
      placeholder:
        "I love you! With every word, every promise, and every little moment. Through every circumstance and every chapter, I will always choose you. This is our story.",
    },
    {
      id: "show_year",
      type: "text",
      label: "Year",
      group: "Your Show",
      help: "Empty uses the current year.",
      maxLength: 4,
      placeholder: "2026",
    },
    {
      id: "show_tags",
      type: "text",
      label: "Tags",
      group: "Your Show",
      help: "Up to three, separated by commas.",
      maxLength: 60,
      placeholder: "Romance, Memories, Forever",
    },
    {
      id: "hero_photo",
      type: "image",
      label: "Main photo",
      group: "Your Show",
      required: true,
      help: "The big photo beside the title. A close, landscape-ish photo of you two works best.",
    },

    // ── Trending Now: five memories ────────────────────────────────
    ...memory(1, "The Day We Met", "I never imagined that one ordinary day would become the beginning of my favorite love story."),
    ...memory(2, "Our First Date", "A day I will never forget."),
    ...memory(3, "Our Favorite Adventure", "Every adventure is better with you."),
    ...memory(4, "Our Little Moments", "The simplest moments mean everything."),
    ...memory(5, "Forever With You", "I would choose you in every lifetime."),
  ],
  sample: {
    photo_mode: "grayscale",
    logo_text: "LOVEFLIX",
    profile_name_1: "You",
    profile_name_2: "Me",
    profile_name_3: "Us",
    profile_name_4: "Forever",
    show_title: "Our Love Story",
    show_subtitle: "Today's Top 10 Love Stories",
    show_description:
      "I love you! With every word, every promise, and every little moment. Through every circumstance and every chapter, I will always choose you. This is our story.",
    show_year: "2026",
    show_tags: "Romance, Memories, Forever",
    hero_photo: "/samples/memory-1.svg",
    memory_title_1: "The Day We Met",
    memory_photo_1: "/samples/memory-2.svg",
    memory_message_1: "I never imagined that one ordinary day would become the beginning of my favorite love story.",
    memory_title_2: "Our First Date",
    memory_photo_2: "/samples/letter-1.svg",
    memory_message_2: "A day I will never forget.",
    memory_title_3: "Our Favorite Adventure",
    memory_photo_3: "/samples/letter-4.svg",
    memory_message_3: "Every adventure is better with you.",
    memory_title_4: "Our Little Moments",
    memory_photo_4: "/samples/memory-3.svg",
    memory_message_4: "The simplest moments mean everything.",
    memory_title_5: "Forever With You",
    memory_photo_5: "/samples/letter-7.svg",
    memory_message_5: "I would choose you in every lifetime.",
  },
});

export type LoveflixData = TemplateData<typeof loveflixDefinition.fields>;
