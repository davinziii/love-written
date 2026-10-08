// Builds the starter frame assets (overlay + preview) for the built-in frames:
//   black-white  — black paper, light text      → public/photobooth/frames/black-white/
//   white        — white paper, dark text       → public/photobooth/frames/white/
//
// Run from the project root:  node scripts/photobooth/build-frames.mjs
// Replace any PNG with your own Photoshop/Figma export — see docs/PHOTOBOOTH_FRAMES.md.
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";

const W = 1200;
const H = 3600;
const SLOT = { x: 60, width: 1080, height: 720 };
const YS = [60, 820, 1580, 2340];
const GUTTER = 20;
const half = (SLOT.width - GUTTER) / 2;

const VARIANTS = [
  { id: "black-white", paper: "#0b0b0b", ink: "#f4f1ea", line: "#f4f1ea", grayscalePreview: true },
  { id: "white", paper: "#f7f4ee", ink: "#1d1a1b", line: "#1d1a1b", grayscalePreview: false },
];

// Windows = where the photos show through (transparent in the overlay).
const windows = YS.flatMap((y) => [
  { x: SLOT.x, y, w: half, h: SLOT.height },
  { x: SLOT.x + half + GUTTER, y, w: half, h: SLOT.height },
]);

const heart = (cx, cy, s, fill) =>
  `<path transform="translate(${cx - 12 * s} ${cy - 11 * s}) scale(${s})" d="M12 21c-5-3.6-9-7.3-9-11.3A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 9 3.1C21 13.7 17 17.4 12 21z" fill="${fill}"/>`;

const samples = ["memory-1", "letter-2", "memory-2", "letter-5", "memory-3", "letter-8", "letter-1", "letter-9"];

for (const v of VARIANTS) {
  const out = `public/photobooth/frames/${v.id}`;
  mkdirSync(out, { recursive: true });
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <mask id="holes">
      <rect width="${W}" height="${H}" fill="white"/>
      ${windows.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="black"/>`).join("")}
    </mask>
  </defs>
  <g mask="url(#holes)"><rect width="${W}" height="${H}" fill="${v.paper}"/></g>
  ${windows.map((r) => `<rect x="${r.x - 1.5}" y="${r.y - 1.5}" width="${r.w + 3}" height="${r.h + 3}" fill="none" stroke="${v.line}" stroke-opacity="0.18" stroke-width="3"/>`).join("")}
  <line x1="420" y1="3170" x2="780" y2="3170" stroke="${v.line}" stroke-opacity="0.35" stroke-width="2"/>
  <text x="600" y="3330" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="104" letter-spacing="14" fill="${v.ink}">LOVE, WRITTEN</text>
  <text x="600" y="3420" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="44" letter-spacing="3" fill="${v.ink}" fill-opacity="0.72">a little photobooth for two</text>
  ${heart(600, 3505, 1.6, v.ink)}
</svg>`;
  const overlay = await sharp(Buffer.from(svg)).png().toBuffer();
  await sharp(overlay).png({ palette: true, colors: 64, compressionLevel: 9 }).toFile(`${out}/frame.png`);

  // Preview: the same composition the server does, with sample illustrations.
  const tiles = await Promise.all(
    windows.map(async (r, i) => {
      let img = sharp(readFileSync(`public/samples/${samples[i]}.svg`)).resize(Math.round(r.w), r.h, { fit: "cover" });
      if (v.grayscalePreview) img = img.grayscale();
      return { input: await img.toBuffer(), left: Math.round(r.x), top: r.y };
    }),
  );
  const full = await sharp({ create: { width: W, height: H, channels: 3, background: v.paper } })
    .composite([...tiles, { input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
  await sharp(full).resize(400).png({ compressionLevel: 9 }).toFile(`${out}/preview.png`);
  console.log("Wrote", out);
}
