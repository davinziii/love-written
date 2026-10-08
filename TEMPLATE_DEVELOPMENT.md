# Template Development Guide

This guide teaches you how Love, Written templates work and how to add your own.
**Our Story** is the complete worked example throughout.

---

## The big picture

```text
              TEMPLATE
                 │
                 ▼
        ┌─────────────────┐
        │ Template Schema │   src/templates/our-story/definition.ts
        │                 │
        │ recipient_name  │
        │ intro_message   │
        │ memory_photo_1  │
        │ memory_1        │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ Generic Editor  │   src/components/editor/GenericEditor.tsx
        │                 │   (never mentions any template by name)
        │ Text input      │
        │ Textarea        │
        │ Image upload    │
        └────────┬────────┘
                 │
                 ▼
          CUSTOMER DATA        surprises.content / surprises.style / media
                 │
                 ▼
        ┌─────────────────┐
        │    Renderer     │   src/templates/our-story/OurStoryRenderer.tsx
        │                 │
        │ Layout          │
        │ Animation       │
        │ Interaction     │
        │ Design          │
        └────────┬────────┘
                 │
                 ▼
       PUBLISHED EXPERIENCE    /s/<secret token>
```

This is the fundamental architecture of Love, Written. Everything else — payment,
checkout, storage, recovery, publishing, scheduling, expiration, cleanup, admin — is
shared application code you never touch when you add a template.

---

## 1. What is a template?

A template is a professionally designed, interactive experience that customers fill in.
In code, a template is exactly **two things**:

| Part | File | Job |
|---|---|---|
| **Definition** (schema) | `src/templates/<id>/definition.ts` | Lists the fields a customer can fill in |
| **Renderer** | `src/templates/<id>/<Name>Renderer.tsx` | Decides how that data looks and behaves |

…plus one line in each of the two registries.

## 2. What is a schema?

The schema is the list of **fields** in the definition. It answers: *"What can the customer
change?"* Nothing else is customizable — no CSS, HTML, layout or fonts outside the curated lists.

## 3. What is a renderer?

A renderer is a trusted React component that you write. It receives validated customer data
and controls the **layout, visual design, animation, decorations, transitions, interaction,
and where each field appears**.

A renderer must **never** decide whether someone paid, whether the surprise is expired,
whether someone may edit, whether the recipient may see it, or whether storage should be
deleted. By the time a renderer runs, the application has already decided all of that
(see `src/app/s/[token]/page.tsx`).

## 4. How fields are defined

Each field is an object with a **semantic id** (what it *means*, not where it sits):

```ts
{
  id: "final_message",          // ✅ semantic — never "bottom_center_text"
  type: "textarea",             // which control the editor shows
  label: "Final message",       // what the customer sees
  group: "The Final Reveal",    // editor section heading
  help: "Revealed last, when they tap the heart.",
  required: true,               // enforced before checkout and publish
  maxLength: 800,               // enforced in the browser AND on the server
  rows: 5,
  placeholder: "Out of everyone in the world, I'd still choose you…",
}
```

Available field types (`src/templates/types.ts`):

| type | Customer sees | Extra properties | Stored in |
|---|---|---|---|
| `text` | single-line input | `maxLength`, `placeholder` | `content` |
| `textarea` | multi-line input | `maxLength`, `rows`, `placeholder` | `content` |
| `image` | photo upload (auto-compressed) | — | `media` table |
| `date` | date picker (`YYYY-MM-DD`) | — | `content` |
| `color` | theme swatches | `options` (theme ids), `default` | `style` |
| `font` | font cards with a sample | `options` (font ids), `default`, `previewText` | `style` |
| `music` | track picker (hidden while the library is empty) | `options` (track ids) | `style` |

Themes, fonts and music tracks are curated in `src/templates/styles.ts`.

> **Never rename a field id** once customers have data for it. If you must change a field
> incompatibly, bump `schemaVersion`.

## 5. How customer data is stored

The template definition and a customer's data are kept separate:

```ts
// The template says: "I require a final_message."
ourStoryDefinition.fields → [{ id: "final_message", required: true, ... }, ...]

// The customer's surprise says: "final_message = I love you."
surprises row → {
  template_id: "our-story",
  schema_version: 1,
  content: { recipient_name: "Samantha", final_message: "I love you.", ... },   // words, dates
  style:   { theme: "blush", font: "classic", music: "none" },              // look & feel
}
media rows   → { field_id: "memory_photo_1", storage_path: "surprises/<id>/<uuid>.webp" }
```

Photos live in a **private** storage bucket. They are turned into short-lived signed URLs
only at the moment a page is shown.

## 6. How the generic editor reads fields

`GenericEditor` loops over `template.fields`, groups them by `field.group`, and renders
`<FieldControl>` for each one. `FieldControl` switches on `field.type` — never on the
template id. That's why adding a template needs **zero** editor changes.

Validation is generic too (`src/templates/schema.ts`):

- **draft mode** (autosave) — types and lengths are enforced; required fields may be empty.
- **strict mode** (checkout, publish, saves while scheduled) — every `required: true` field
  must be present, including photos.

**Photo groups.** A group made only of image fields (e.g. "Your Photos") is shown as a
compact grid of tiles that also accepts pasted and dropped photos — no extra work needed.

**Look & Feel conventions (every template).** Keep this section identical across templates
so customers always see the same controls:

| Field id | Type | Label | Options | Notes |
|---|---|---|---|---|
| `theme` | color | **Color theme** | `THEME_IDS` (all 10) | shown as a palette dropdown |
| `story_font` | font | **Font style** | `STORY_FONT_IDS` (all 6) | `picker: "dropdown"` |
| `final_font` | font | template-specific, e.g. **Greeting font** / **Final message font** | `FINAL_FONT_IDS` (all 6) | cards (default picker) |

Renderers must therefore look good with **every** theme, including the dark ones
(`midnight`, `noir`) — e.g. text printed on light "paper" needs its own dark ink color.

The same function runs in the browser (to show "a few things still need your attention")
and on the server (the one that actually counts).

## 7. How the renderer receives data

TypeScript derives the renderer's data type **from the field list**, so the two can't drift:

```ts
// src/templates/our-story/definition.ts
export const ourStoryDefinition = defineTemplate({ id: "our-story", fields: [ ... ], ... });
export type OurStoryData = TemplateData<typeof ourStoryDefinition.fields>;
```

`OurStoryData` is effectively:

```ts
type OurStoryData = {
  recipient_name: string;     // required → always a string
  intro_message: string;
  memory_photo_1: string;     // image → a ready-to-use URL
  memory_1: string;
  final_message: string;
  theme: string;              // style fields always have a value (defaults)
  font: string;
  music: string;
  memory_photo_2?: string;    // optional → may be undefined
  memory_2?: string;
  // ...
};
```

The renderer simply uses it:

```tsx
export function OurStoryRenderer({ data, mode }: RendererProps<OurStoryData>) {
  const theme = getTheme(data.theme);
  const story = getFont(data.story_font, "lora");
  const final = getFont(data.final_font, "great_vibes");
  return (
    <div style={themeVars(theme, story, final)}>
      <h1>{data.recipient_name}</h1>          {/* text is rendered as text — never as HTML */}
      <p>{data.intro_message}</p>
      <img src={data.memory_photo_1} alt="" />
      {data.memory_photo_2 && <img src={data.memory_photo_2} alt="" />}
      <h2>{data.final_message}</h2>
    </div>
  );
}
```

The real `OurStoryRenderer.tsx` adds the envelope cover, scroll reveals, polaroid photos,
the tap-to-reveal finale and the "Made with ♥ by Love, Written" footer — but the lesson is:

```text
Database fields → Customer data → Typed renderer → Visual experience
```

---

## 8. Create a new renderer — worked example: "Birthday Surprise"

### Step 1 — Design the experience

Sketch it on paper first, phone-sized. Decide the moments (e.g. *cover → candles → wishes
→ photo → blow out the candles → message*). Then decide which pieces of content each moment
needs. Those become your fields.

### Step 2 — Define the fields

Create `src/templates/birthday-surprise/definition.ts`:

```ts
import { defineTemplate, type TemplateData } from "../types";
import { FINAL_FONT_IDS, STORY_FONT_IDS } from "../styles";

export const birthdaySurpriseDefinition = defineTemplate({
  id: "birthday-surprise",
  name: "Birthday Surprise",
  tagline: "Candles, wishes and a message they unwrap.",
  description: "A playful birthday experience they open with a tap and finish by blowing out the candles.",
  category: "Birthday",
  schemaVersion: 1,
  listed: false, // keep hidden until it's ready (section 10)
  highlights: ["Tap-to-light candles", "A photo wall of the year", "A wish they unwrap"],
  fields: [
    { id: "recipient_name", type: "text", label: "Birthday person's name", group: "The Party", required: true, maxLength: 40 },
    { id: "age", type: "text", label: "Age they're turning", group: "The Party", maxLength: 3, help: "Optional" },
    { id: "birthday_message", type: "textarea", label: "Birthday message", group: "The Party", required: true, maxLength: 600, rows: 4 },
    { id: "favorite_photo", type: "image", label: "Favorite photo of them", group: "Photos", required: true },
    { id: "wish", type: "textarea", label: "Your wish for them", group: "The Wish", required: true, maxLength: 300 },
    { id: "sender_name", type: "text", label: "From", group: "The Wish", required: true, maxLength: 40 },
    { id: "theme", type: "color", label: "Color theme", group: "Look & Feel", options: THEME_IDS, default: "sunset" },
    { id: "story_font", type: "font", label: "Font style", group: "Look & Feel", options: STORY_FONT_IDS, default: "nunito", previewText: "Happy birthday", picker: "dropdown" },
    { id: "final_font", type: "font", label: "Wish font", group: "The Wish", options: FINAL_FONT_IDS, default: "dancing", previewText: "Make a wish" },
  ],
  sample: {
    recipient_name: "Jamie", age: "30", birthday_message: "Thirty looks amazing on you…",
    favorite_photo: "/samples/memory-1.svg", wish: "More adventures.", sender_name: "Alex",
    theme: "sunset", story_font: "nunito", final_font: "dancing",
  },
});

export type BirthdaySurpriseData = TemplateData<typeof birthdaySurpriseDefinition.fields>;
```

`sample` powers the catalog and template-page previews. Every required field needs a
sample value (a unit test checks this). Sample images must be your own (see `public/samples/`).

### Step 3 — Create the renderer

Create `src/templates/birthday-surprise/BirthdaySurpriseRenderer.tsx`:

```tsx
"use client";

import type { CSSProperties } from "react";
import type { RendererProps } from "../types";
import { getFont, getTheme, themeVars } from "../styles";
import type { BirthdaySurpriseData } from "./definition";
import s from "./birthday-surprise.module.css";

export function BirthdaySurpriseRenderer({ data }: RendererProps<BirthdaySurpriseData>) {
  const vars = themeVars(
    getTheme(data.theme),
    getFont(data.story_font, "nunito"),
    getFont(data.final_font, "dancing"),
  ) as CSSProperties;
  return (
    <div className={s.root} style={vars}>
      <section className={s.cover}>
        <h1>Happy birthday, {data.recipient_name}!</h1>
        {data.age && <p>{data.age} looks good on you</p>}
      </section>
      {/* ...your design... */}
      <p>{data.wish}</p>
      <p>— {data.sender_name}</p>
    </div>
  );
}
```

Renderer rules of thumb:

- Mobile first. Size full-screen sections with `min-height: var(--lw-screen-h, 100svh)` so
  they fit both the preview phone frame and a real phone.
- Use the theme CSS variables (`--lw-bg`, `--lw-ink`, `--lw-accent`, `--lw-heading` …).
- Render customer text as `{text}` — never `dangerouslySetInnerHTML`.
- Respect `prefers-reduced-motion`. Keep it light: CSS animations, no heavy libraries.
- Reuse helpers in `src/templates/shared/` (icons, dates, scroll reveal).

### Step 4 — Register the definition

`src/templates/index.ts`:

```ts
import { birthdaySurpriseDefinition } from "./birthday-surprise/definition";

export const TEMPLATES = {
  "our-story": ourStoryDefinition,
  "birthday-surprise": birthdaySurpriseDefinition,   // ← add
} as const satisfies Record<string, TemplateDefinition>;
```

### Step 5 — Register the renderer

`src/templates/renderers.tsx`:

```ts
import { BirthdaySurpriseRenderer } from "./birthday-surprise/BirthdaySurpriseRenderer";

export const RENDERERS: Record<TemplateId, AnyRenderer> = {
  "our-story": register(OurStoryRenderer),
  "birthday-surprise": register(BirthdaySurpriseRenderer),   // ← add
};
```

If you forget this step, **TypeScript refuses to compile** — the renderer map must cover
every template id.

### Step 6 — The generic editor does the rest

There is no Step 6 for you. The editor, validation, autosave, image upload, preview with
watermark, checkout, PayMongo, publishing, scheduling, the recipient page, expiration,
cleanup and the admin dashboard all work for the new template automatically.

## 9. Test it

```bash
npm run typecheck
```

```bash
npm test
```

Then run `npm run dev` and:

1. Temporarily set `listed: true` on your machine (unlisted templates return 404 on the
   template page) and open `/surprises/birthday-surprise`.
2. Click **Customize**, fill every field, upload photos, switch themes and fonts — the
   preview should update instantly.
3. Leave a required field empty and click **Preview** — you should see it highlighted.
4. Check the phone preview at 375px width and with *reduce motion* enabled in your OS.
5. With PayMongo test keys, complete a test payment and publish; open the `/s/…` link on a phone.

## 10. Publish it to the catalog

Set `listed: true` in the definition and deploy. It appears on **Pick a Surprise** and on
the admin **Templates** page. Set it back to `false` to hide it from new customers —
existing surprises keep working because the renderer stays registered.

> Never delete a registered template that has live surprises. Hide it instead.

---

## Adding music

Music is optional and only from the Love, Written library — no uploads, Spotify or YouTube.

1. Get a track you **own or have a commercial license for** (royalty-free with a license that
   permits use in a paid product). Keep proof of the license.
2. Put the file in `public/music/` (MP3, ~1–2 MB, loop-friendly).
3. Add it to `MUSIC_LIBRARY` in `src/templates/styles.ts` with an accurate `license` note.
4. Add its id to a template's music field `options`.

While the library is empty, music fields are hidden from the editor and renderers play nothing.

## Adding a field type (rare)

1. Add the type to `FieldType` and a new interface in `src/templates/types.ts`.
2. Validate it in `fieldValueSchema()` in `src/templates/schema.ts`.
3. Render a control for it in `src/components/editor/FieldControl.tsx`.

Future types like `gallery` or `multiple_images` follow the same three steps.
