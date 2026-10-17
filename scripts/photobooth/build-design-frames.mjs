// Builds the "Love, Written." designer frames (overlay, solo overlay, preview):
//   cream, maroon, noir             — tall strips, three photos stacked
//   landscape-red, landscape-black  — wide strips, three photos in a row under a header
//
// Run from the project root:  node scripts/photobooth/build-design-frames.mjs
// Every window is transparent in the overlay; the photos are placed underneath by the server.
// The matching configs live in src/photobooth/frames/<id>/config.ts — keep the numbers in sync.
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";

const WEBSITE = "lovewritten.com";
const CREAM = "#fdfcf5";
const MAROON = "#7d0a0a";
const BLACK = "#0b0b0b";
const WHITE = "#ffffff";
const GUTTER = 20; // between Person A and Person B inside one window
const SERIF = "Georgia, 'Times New Roman', serif";

// ─── Tall strips (1200 × 3300): three photos stacked, name at the bottom ────
const TALL = { W: 1200, H: 3300, x: 150, w: 990, h: 840, ys: [70, 960, 1850] };
const tallSlots = TALL.ys.map((y) => ({ x: TALL.x, y, width: TALL.w, height: TALL.h }));

function tallSvg({ paper, ink, border }, holes) {
  const { W, H } = TALL;
  const cx = TALL.x + TALL.w / 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><mask id="m"><rect width="${W}" height="${H}" fill="white"/>${holes.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="black"/>`).join("")}</mask></defs>
  <g mask="url(#m)"><rect width="${W}" height="${H}" fill="${paper}"/></g>
  ${border ? `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" fill="none" stroke="${border}" stroke-width="6"/>` : ""}
  <text transform="translate(78 80) rotate(90)" font-family="${SERIF}" font-size="44" font-weight="700" fill="${ink}">${WEBSITE}</text>
  <text x="${cx}" y="2930" text-anchor="middle" font-family="${SERIF}" font-size="200" font-weight="700" fill="${ink}">Love,</text>
  <text x="${cx}" y="3140" text-anchor="middle" font-family="${SERIF}" font-size="200" font-weight="700" fill="${ink}">Written.</text>
</svg>`;
}

// ─── Wide strips (3200 × 1160): header, then three photos in a colored band ──
const WIDE = { W: 3200, H: 1160, header: 280, bar: 24 };
const wideW = Math.floor((WIDE.W - WIDE.bar * 4) / 3);
const wideX0 = Math.floor((WIDE.W - (wideW * 3 + WIDE.bar * 2)) / 2);
const wideSlots = [0, 1, 2].map((i) => ({
  x: wideX0 + i * (wideW + WIDE.bar),
  y: WIDE.header + WIDE.bar,
  width: wideW,
  height: WIDE.H - WIDE.header - WIDE.bar * 2,
}));

function wideSvg({ band, ink }, holes) {
  const { W, H, header } = WIDE;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><mask id="m"><rect width="${W}" height="${H}" fill="white"/>${holes.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="black"/>`).join("")}</mask></defs>
  <g mask="url(#m)">
    <rect width="${W}" height="${H}" fill="${CREAM}"/>
    <rect y="${header}" width="${W}" height="${H - header}" fill="${band}"/>
  </g>
  <text x="70" y="128" font-family="${SERIF}" font-size="100" font-weight="700" fill="${ink}">Love,</text>
  <text x="70" y="232" font-family="${SERIF}" font-size="100" font-weight="700" fill="${ink}">Written.</text>
  <text x="${W - 70}" y="228" text-anchor="end" font-family="${SERIF}" font-size="54" font-weight="700" fill="${ink}">${WEBSITE}</text>
</svg>`;
}

// Two people share a window (A left, B right, with a gutter); solo fills the window.
const pairHoles = (slots) =>
  slots.flatMap((s) => {
    const left = Math.floor((s.width - GUTTER) / 2);
    return [
      { x: s.x, y: s.y, w: left, h: s.height },
      { x: s.x + left + GUTTER, y: s.y, w: s.width - GUTTER - left, h: s.height },
    ];
  });
const soloHoles = (slots) => slots.map((s) => ({ x: s.x, y: s.y, w: s.width, h: s.height }));

const DESIGNS = [
  { id: "cream", kind: "tall", style: { paper: CREAM, ink: MAROON, border: "#9b9b9b" }, background: CREAM },
  { id: "maroon", kind: "tall", style: { paper: MAROON, ink: WHITE }, background: MAROON },
  { id: "noir", kind: "tall", style: { paper: BLACK, ink: WHITE }, background: BLACK },
  { id: "landscape-red", kind: "wide", style: { band: MAROON, ink: MAROON }, background: MAROON },
  { id: "landscape-black", kind: "wide", style: { band: BLACK, ink: BLACK }, background: BLACK },
];

const samples = ["memory-1", "letter-2", "memory-2", "letter-5", "memory-3", "letter-8", "letter-1", "letter-9"];

const png = async (svg) => sharp(Buffer.from(svg)).png().toBuffer();
const small = (buf, file) => sharp(buf).png({ palette: true, colors: 64, compressionLevel: 9 }).toFile(file);

for (const d of DESIGNS) {
  const out = `public/photobooth/frames/${d.id}`;
  mkdirSync(out, { recursive: true });
  const slots = d.kind === "tall" ? tallSlots : wideSlots;
  const W = d.kind === "tall" ? TALL.W : WIDE.W;
  const H = d.kind === "tall" ? TALL.H : WIDE.H;
  const draw = (holes) => (d.kind === "tall" ? tallSvg(d.style, holes) : wideSvg(d.style, holes));

  const pairHoleList = pairHoles(slots);
  const overlay = await png(draw(pairHoleList));
  await small(overlay, `${out}/frame.png`);
  await small(await png(draw(soloHoles(slots))), `${out}/frame-solo.png`);

  // Preview: sample pictures in the two-person windows, like the server builds it.
  const tiles = await Promise.all(
    pairHoleList.map(async (r, i) => ({
      input: await sharp(readFileSync(`public/samples/${samples[i % samples.length]}.svg`)).resize(r.w, r.h, { fit: "cover" }).toBuffer(),
      left: r.x,
      top: r.y,
    })),
  );
  const full = await sharp({ create: { width: W, height: H, channels: 3, background: d.background } })
    .composite([...tiles, { input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
  await sharp(full).resize(d.kind === "tall" ? 400 : 800).png({ compressionLevel: 9 }).toFile(`${out}/preview.png`);
  console.log("Wrote", out, JSON.stringify({ W, H, slots }));
}
