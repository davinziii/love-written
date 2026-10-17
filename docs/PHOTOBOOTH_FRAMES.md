# Adding a new photobooth frame

A **frame** is one strip design. You design it in Photoshop / Figma / Canva, export two
PNGs, write a small config, and register it with one line. Nothing else in the photobooth
changes — the selector, the strip generator and the downloads all read the config.

```
src/photobooth/frames/
  index.ts                 ← add ONE import + ONE entry here
  my-new-frame/
    config.ts              ← sizes and photo slot positions

public/photobooth/frames/
  my-new-frame/
    frame.png              ← the design, with transparent "windows" where photos go
    frame-solo.png         ← same design, one window per slot (solo photobooth)
    preview.png            ← small picture shown in the selector
```

(Configs live under `src/`; images live under `public/` so browsers can load the preview and
the server can read the overlay. The folder name = the frame `id`.)

## 1. Canvas size & aspect ratio

- **Recommended: 1200 × 3600 px** (a classic 2 × 6 inch strip at 600 dpi, ratio **1 : 3**).
- Any size works; keep it ≤ 2400 px on the long side and keep the 1 : 3 ratio for a
  "real" strip. Every number in the config is in these output pixels.

## 1b. Landscape frames

Any shape works — the strip builder and the live preview only read `width`, `height` and the
slot coordinates. A landscape design (e.g. **3600 × 2400**, four slots in a 2 × 2 grid) is just a
config with different numbers. Keep the long side ≤ 2400 px if you can (larger is fine, just
slower to build). The result screen shows wide frames wide automatically.

## 2. Where the photos go (slots)

There are always **3 slots** (one per photo, `PHOTOBOOTH_ROUNDS`), in photo order. Each slot holds one moment
from **both** people: **Person A on the left, Person B on the right**, separated by a
`gutter` you choose. So each slot is really two photo windows side by side.

```
 x ───────────── slot width ─────────────
 ┌──────────────┐ gutter ┌──────────────┐  ┐
 │   Person A   │        │   Person B   │  │ slot height
 └──────────────┘        └──────────────┘  ┘
```

- Photos are captured **3 : 4 portrait** and cropped to fill each window ("cover", centred on
  the most interesting area), so windows close to 3 : 4 look best. With a 1080 px slot and
  a 20 px gutter each window is 530 × 720 (≈ 3 : 4).
- Leave a margin around the slots (60 px in Black & White) and room for your branding
  (Black & White keeps the bottom 540 px for "LOVE, WRITTEN").

## 3. Measure the coordinates

For each slot write down, in pixels from the **top-left corner**:
`x` (left edge), `y` (top edge), `width`, `height` — of the whole slot (both windows +
gutter). In Figma: select the slot rectangle → read X, Y, W, H. In Photoshop: Info panel /
Properties with units set to pixels.

## 4. Export `frame.png` (the overlay)

- **PNG with transparency**, exactly the canvas size (e.g. 1200 × 3600).
- Make the **photo windows fully transparent** (the two windows of every slot). Photos are
  placed underneath and show through.
- Everything else (paper colour, borders, text, doodles) is opaque or semi-transparent and
  sits **on top** of the photos — so you can let a sticker or heart overlap a photo edge.
- Safe zone: keep important art at least **40 px** away from the canvas edges, and don't put
  anything important inside the windows (it would cover faces).
- Keep it small: flat colours compress well. Aim for < 300 KB (export as "PNG-8" / 64–256
  colours if it still looks right).

## 4b. Export `frame-solo.png` (for the solo photobooth)

The same design, but with **one** transparent window per slot (the whole slot). Solo sessions
capture one **landscape 3 : 2** photo per moment, which fills the slot — so solo slots look best
close to 3 : 2 (1080 × 720 is exactly that). Set it as `soloOverlay` in the config. Without one,
solo strips fall back to `frame.png`, whose divider between the two windows would cross the photo.

## 5. Export `preview.png`

- What people see in "Choose your photobooth" (and the landing page shows the default one).
- About **400 px wide**, same 1 : 3 ratio, with sample photos inside so it looks finished.
- Tip: run the project's builders as examples of how ours are made:
  `node scripts/photobooth/build-frames.mjs` (Black and White) and
  `node scripts/photobooth/build-design-frames.mjs` (the "Love, Written." designs: Cream, Maroon,
  Noir and the two wide ones). Each writes `frame.png`, `frame-solo.png` and `preview.png`.

## 6. Write `config.ts`

```ts
// src/photobooth/frames/my-new-frame/config.ts
import type { PhotoboothFrame } from "../types";

const SLOT = { x: 60, width: 1080, height: 720 } as const;

const frame: PhotoboothFrame = {
  id: "my-new-frame",                 // = folder name; lowercase, numbers, dashes
  name: "My New Frame",               // shown in the selector
  description: "One short line about the look.",
  width: 1200,                        // output size in px
  height: 3600,
  background: "#ffffff",              // shows wherever the overlay is transparent and no photo is
  slots: [
    { ...SLOT, y: 60 },               // photo 1
    { ...SLOT, y: 820 },              // photo 2
    { ...SLOT, y: 1580 },             // photo 3
  ],
  gutter: 20,                         // space between Person A and Person B inside a slot
  grayscale: false,                   // default filter (people pick B&W or color after their photos)
  overlay: "/photobooth/frames/my-new-frame/frame.png",   // or null for no overlay
  soloOverlay: "/photobooth/frames/my-new-frame/frame-solo.png", // one window per slot (solo)
  preview: "/photobooth/frames/my-new-frame/preview.png",
};

export default frame;
```

People choose **black & white or color** themselves after their photos (and which frame);
the choice starts on the look they used for their live camera. The individual photo
downloads always stay in colour.

## 7. Register it (the only code change)

```ts
// src/photobooth/frames/index.ts
import blackWhite from "./black-white/config";
import myNewFrame from "./my-new-frame/config";      // ← add

export const FRAMES: readonly PhotoboothFrame[] = [blackWhite, myNewFrame];  // ← add
```

The first frame in the list is the default. The selector shows them in this order.

## 8. Test it

1. `npx vitest run tests/photobooth.test.ts` — checks every frame config (3 slots, inside
   the image, big enough, paths in the right folder).
2. `npm run dev`, open a photobooth session → your frame appears in *Choose your photobooth*.
3. Finish a session with it (two browsers or phone + laptop) and look at the downloaded
   strip. If a photo is misplaced, adjust that slot's `x/y/width/height` and try again.

## How the final image is made

On the server, after the last photo is approved by both people (`composeStrip` in
`src/lib/photobooth/images.ts`):

1. Start a blank `width × height` canvas filled with `background`.
2. For each slot `n`: take photo `n` from Person A and from Person B, crop each to its window
   (`(width − gutter) / 2 × height`), apply grayscale if they chose black & white, and place
   them left / right.
3. Put `frame.png` on top.
4. Save as JPEG → that's the downloadable strip (kept 7 days, like the photos).

No CSS screenshots — it's a real image file generated with `sharp`.
