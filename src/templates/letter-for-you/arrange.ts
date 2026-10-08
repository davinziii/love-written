/**
 * Photo arrangement for "A Letter for You" (pure — no DOM, unit-tested).
 *
 * Phone / tablet ("stack"): two photos peek above the letter, the rest scatter below.
 * Desktop: photos fill the columns BESIDE the letter — only as tall as the letter
 * actually is — and whatever doesn't fit goes to a row underneath. A short letter
 * therefore gets more photos at the bottom; a long letter keeps them all beside it.
 */

export type Size = "s" | "m" | "l";
export type Group = "top" | "left" | "right" | "bottom";
export type Align = "start" | "center" | "end";

/** Polaroid widths in rem. */
export const SIZE_REM: Record<Size, number> = { s: 8, m: 10, l: 12.5 };

export interface PhotoStyle {
  size: Size;
  aspect: "4 / 5" | "1 / 1";
  r: number; // resting rotation (deg)
  sway: number; // wiggle amplitude (deg)
  lift: number; // wiggle lift (px)
  wd: number; // wiggle duration (s)
}

/** Hand-picked mix of sizes, shapes and tilts so no two neighbours look alike. */
export const PHOTO_STYLES: PhotoStyle[] = [
  { size: "l", aspect: "4 / 5", r: -5, sway: 1.5, lift: 4, wd: 6.2 },
  { size: "s", aspect: "1 / 1", r: 6, sway: 1.4, lift: 5, wd: 7.1 },
  { size: "m", aspect: "4 / 5", r: 3, sway: 1.2, lift: 4, wd: 6.8 },
  { size: "m", aspect: "1 / 1", r: -6, sway: 1.5, lift: 6, wd: 7.6 },
  { size: "s", aspect: "4 / 5", r: 4, sway: 1.3, lift: 4, wd: 6.4 },
  { size: "l", aspect: "1 / 1", r: -3, sway: 1.4, lift: 5, wd: 7.3 },
  { size: "m", aspect: "4 / 5", r: 5, sway: 1.2, lift: 4, wd: 6.6 },
  { size: "s", aspect: "1 / 1", r: -4, sway: 1.6, lift: 6, wd: 7.9 },
  { size: "l", aspect: "4 / 5", r: -2, sway: 1.3, lift: 5, wd: 6.9 },
  { size: "m", aspect: "1 / 1", r: 4, sway: 1.5, lift: 4, wd: 7.4 },
  { size: "s", aspect: "4 / 5", r: -6, sway: 1.2, lift: 5, wd: 6.5 },
  { size: "m", aspect: "4 / 5", r: 6, sway: 1.4, lift: 4, wd: 7.7 },
];

export interface Placement {
  index: number; // photo index (0-based)
  group: Group;
  order: number; // reveal order
  align: Align; // horizontal position inside a side column (desktop)
}

const FRAME_PX = 31; // polaroid padding (7 top + 24 bottom)
const GAP_REM = 1.6; // vertical gap between photos in a side column
const OVERHANG_PX = 48; // photos may extend slightly past the letter's top/bottom

/** Estimated on-screen height of a photo in a side column, including the gap. */
export function photoHeight(style: PhotoStyle, remPx = 16): number {
  const w = SIZE_REM[style.size] * remPx;
  const ratio = style.aspect === "4 / 5" ? 1.25 : 1;
  return w * ratio + FRAME_PX + GAP_REM * remPx;
}

export function arrangeStack(indices: number[]): Placement[] {
  return indices.map((index, i) => ({ index, group: i < 2 ? "top" : "bottom", order: i, align: "center" }));
}

const LEFT_ALIGN: Align[] = ["end", "start", "center"];
const RIGHT_ALIGN: Align[] = ["start", "end", "center"];

export function arrangeDesktop(indices: number[], letterHeightPx: number, remPx = 16): Placement[] {
  const capacity = letterHeightPx + OVERHANG_PX;
  const used = { left: 0, right: 0 };
  const count = { left: 0, right: 0 };
  const placed: Placement[] = [];
  const bottom: number[] = [];

  for (const index of indices) {
    const h = photoHeight(PHOTO_STYLES[index % PHOTO_STYLES.length]!, remPx);
    // Fill the emptier side first so both columns grow evenly.
    const first: "left" | "right" = used.left <= used.right ? "left" : "right";
    const second: "left" | "right" = first === "left" ? "right" : "left";
    const side = used[first] + h <= capacity ? first : used[second] + h <= capacity ? second : null;
    if (!side) {
      bottom.push(index);
      continue;
    }
    const align = (side === "left" ? LEFT_ALIGN : RIGHT_ALIGN)[count[side] % 3]!;
    placed.push({ index, group: side, order: placed.length, align });
    used[side] += h;
    count[side]++;
  }

  for (const index of bottom) placed.push({ index, group: "bottom", order: placed.length, align: "center" });
  return placed;
}
