// Builds the starter "Black & White" frame assets:
//   public/photobooth/frames/black-white/frame.png    (1200×3600 overlay, transparent windows)
//   public/photobooth/frames/black-white/preview.png  (small strip with sample photos)
//
// Run from the project root:  node scripts/photobooth/build-black-white.mjs
// Replace the PNGs with your own Photoshop/Figma export any time — see docs/PHOTOBOOTH_FRAMES.md.
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = "public/photobooth/frames/black-white";
const W = 1200;
const H = 3600;
const SLOT = { x: 60, width: 1080, height: 720 };
const YS = [60, 820, 1580, 2340];
const GUTTER = 20;
const half = (SLOT.width - GUTTER) / 2;

mkdirSync(OUT, { recursive: true });

// Windows = where the photos show through (transparent in the overlay).
const windows = YS.flatMap((y) => [
  { x: SLOT.x, y, w: half, h: SLOT.height },
  { x: SLOT.x + half + GUTTER, y, w: half, h: SLOT.height },
]);

const heart = (cx, cy, s) =>
  `<path transform="translate(${cx - 12 * s} ${cy - 11 * s}) scale(${s})" d="M12 21c-5-3.6-9-7.3-9-11.3A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 9 3.1C21 13.7 17 17.4 12 21z" fill="#f4f1ea"/>`;

const overlaySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <mask id="holes">
      <rect width="${W}" height="${H}" fill="white"/>
      ${windows.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="black"/>`).join("")}
    </mask>
  </defs>
  <g mask="url(#holes)">
    <rect width="${W}" height="${H}" fill="#0b0b0b"/>
  </g>
  ${windows.map((r) => `<rect x="${r.x - 1.5}" y="${r.y - 1.5}" width="${r.w + 3}" height="${r.h + 3}" fill="none" stroke="#f4f1ea" stroke-opacity="0.18" stroke-width="3"/>`).join("")}
  <line x1="420" y1="3170" x2="780" y2="3170" stroke="#f4f1ea" stroke-opacity="0.35" stroke-width="2"/>
  <text x="600" y="3330" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="104" letter-spacing="14" fill="#f4f1ea">LOVE, WRITTEN</text>
  <text x="600" y="3420" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="44" letter-spacing="3" fill="#f4f1ea" fill-opacity="0.72">a little photobooth for two</text>
  ${heart(600, 3505, 1.6)}
</svg>`;

const overlay = await sharp(Buffer.from(overlaySvg)).png({ compressionLevel: 9 }).toBuffer();
await sharp(overlay).png({ palette: true, colors: 64, compressionLevel: 9 }).toFile(`${OUT}/frame.png`);

// Preview: run the same composition the server does, with sample illustrations.
const samples = ["memory-1", "letter-2", "memory-2", "letter-5", "memory-3", "letter-8", "letter-1", "letter-9"];
const tiles = await Promise.all(
  windows.map(async (r, i) => ({
    input: await sharp(readFileSync(`public/samples/${samples[i]}.svg`))
      .resize(Math.round(r.w), r.h, { fit: "cover" })
      .grayscale()
      .toBuffer(),
    left: Math.round(r.x),
    top: r.y,
  })),
);
const full = await sharp({ create: { width: W, height: H, channels: 3, background: "#0b0b0b" } })
  .composite([...tiles, { input: overlay, left: 0, top: 0 }])
  .png()
  .toBuffer();
await sharp(full).resize(400).png({ compressionLevel: 9 }).toFile(`${OUT}/preview.png`);

console.log("Wrote", `${OUT}/frame.png`, "and", `${OUT}/preview.png`);
