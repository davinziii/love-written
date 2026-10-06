import qrcode from "qrcode-generator";

/**
 * Heart-shaped QR code (pure — no DOM), returned as an SVG string.
 *
 * Scannability first:
 *  • Error correction level M (standard). Nothing covers the code, so a higher level would
 *    only add modules and make each one smaller — worse for small screens and cameras.
 *  • A clean white margin of QUIET modules around the real code.
 *  • Real modules are dark rose (high contrast on white); the decorative dots that fill
 *    the heart are pale pink, which scanners treat as background.
 *
 * Shape: a "round" heart — two circular lobes with a shallow dip and straight sides to a
 * point — so a large square code fits fully inside without breaking the outline.
 */

const QUIET = 3;
/** Lobe centres sit at ±LOBE_OFFSET (lobe radius = 1). Smaller = shallower dip. */
const LOBE_OFFSET = 0.62;
/** Distance from the lobe centres down to the tip. */
const TIP = 1.85;

export interface HeartQrOptions {
  dark?: string; // real QR modules
  decor?: string; // decorative dots (keep pale)
  outline?: string; // heart outline
  paper?: string; // heart fill
}

export interface HeartQr {
  svg: string;
  /** Square side in module units (for sizing). */
  units: number;
}

type Pt = [number, number];

/** Heart outline in unit coordinates (y down), lobes radius 1. */
function unitHeart(): Pt[] {
  const a = LOBE_OFFSET;
  // Right lobe: arc from the centre dip, over the top, to where the straight side begins.
  const dist = Math.hypot(a, TIP);
  const towardsTip = Math.atan2(TIP, -a);
  const tangent = towardsTip - Math.acos(1 / dist); // the outer tangent point
  const dip = Math.atan2(-Math.sqrt(1 - a * a), -a);
  const right: Pt[] = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const t = dip + ((tangent - dip) * i) / steps;
    right.push([a + Math.cos(t), Math.sin(t)]);
  }
  const left: Pt[] = right.map(([x, y]) => [-x, y] as Pt).reverse();
  return [...right, [0, TIP], ...left];
}

function pointInPolygon(px: number, py: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The heart scaled into an S×S grid (module units), centred, with a small margin. */
function heartPolygon(S: number): Pt[] {
  const width = 2 * (LOBE_OFFSET + 1);
  const height = 1 + TIP;
  const margin = 1.2;
  const k = (S - 2 * margin) / Math.max(width, height);
  const top = (S - height * k) / 2;
  return unitHeart().map(([x, y]) => [S / 2 + x * k, top + (y + 1) * k] as Pt);
}

/** Every point along the square's edges (half-module steps) must be inside the heart. */
function squareInside(x0: number, y0: number, side: number, poly: Pt[]): boolean {
  for (let s = 0; s <= side; s += 0.5) {
    if (
      !pointInPolygon(x0 + s, y0, poly) ||
      !pointInPolygon(x0 + s, y0 + side, poly) ||
      !pointInPolygon(x0, y0 + s, poly) ||
      !pointInPolygon(x0 + side, y0 + s, poly)
    ) {
      return false;
    }
  }
  return true;
}

/** Small deterministic PRNG so the same link always gets the same decoration. */
function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const isFinder = (r: number, c: number, n: number) =>
  (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

export function heartQrSvg(text: string, opts: HeartQrOptions = {}): HeartQr {
  const dark = opts.dark ?? "#8e2747";
  const decor = opts.decor ?? "#f6c9d3";
  const outline = opts.outline ?? "#c4486a";
  const paper = opts.paper ?? "#ffffff";

  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const block = n + QUIET * 2;

  // Smallest heart that fully contains the code + its white margin.
  let S = 0;
  let ox = 0;
  let oy = 0;
  let poly: Pt[] = [];
  for (let size = block + 2; size <= block * 3 && !S; size++) {
    const candidate = heartPolygon(size);
    const x0 = (size - block) / 2;
    const fits: number[] = [];
    for (let y0 = 0; y0 <= size - block; y0 += 0.5) {
      if (squareInside(x0, y0, block, candidate)) fits.push(y0);
    }
    if (fits.length) {
      S = size;
      ox = x0;
      oy = fits[Math.floor(fits.length / 2)]!;
      poly = candidate;
    }
  }

  const parts: string[] = [];
  const d = poly.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("") + "Z";
  parts.push(`<path d="${d}" fill="${paper}" stroke="${outline}" stroke-width="1.1" stroke-linejoin="round"/>`);

  // Decorative dots in the rest of the heart (pale, so scanners ignore them).
  const rand = seeded(text);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      if (cx > ox - 0.6 && cx < ox + block + 0.6 && cy > oy - 0.6 && cy < oy + block + 0.6) continue;
      const clearOfOutline = [
        [cx, cy],
        [cx - 0.8, cy],
        [cx + 0.8, cy],
        [cx, cy - 0.8],
        [cx, cy + 0.8],
      ].every(([px, py]) => pointInPolygon(px!, py!, poly));
      if (clearOfOutline && rand() < 0.45) parts.push(`<circle cx="${cx}" cy="${cy}" r="0.36" fill="${decor}"/>`);
    }
  }

  // Real QR modules.
  const qx = ox + QUIET;
  const qy = oy + QUIET;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c) || isFinder(r, c, n)) continue;
      parts.push(`<rect x="${qx + c + 0.04}" y="${qy + r + 0.04}" width="0.92" height="0.92" rx="0.22" fill="${dark}"/>`);
    }
  }
  // Finder patterns as rounded squares (same geometry, softer look).
  for (const [fr, fc] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ] as const) {
    const x = qx + fc;
    const y = qy + fr;
    parts.push(
      `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="1.6" fill="none" stroke="${dark}" stroke-width="1"/>`,
      `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.9" fill="${dark}"/>`,
    );
  }

  const pad = 1;
  const units = S + pad * 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${units} ${units}" shape-rendering="geometricPrecision">` +
    parts.join("") +
    `</svg>`;
  return { svg, units };
}
