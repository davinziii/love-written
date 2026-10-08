/**
 * Photo arrangement for "A Letter for You" (pure — no DOM, unit-tested).
 *
 * Phone / tablet ("stack"): two photos peek above the letter, the rest scatter below.
 * Desktop: photos fill the space BESIDE the letter — one or two staggered columns per
 * side, depending on how much room there is — but only as tall as the letter actually
 * is. Whatever doesn't fit goes to a scattered row underneath. A short letter therefore
 * gets more photos at the bottom; a long letter keeps them all beside it.
 */

export type Size = "s" | "m" | "l";
export type Group = "top" | "left" | "right" | "bottom";
export type Align = "start" | "center" | "end";
export type Deco = "tape" | "pin" | "none";

/** Width relative to the column a photo sits in. */
export const SIZE_FACTOR: Record<Size, number> = { s: 0.76, m: 0.88, l: 1 };
/** Widths in the bottom row (rem). */
export const BOTTOM_REM: Record<Size, number> = { s: 11.5, m: 13.5, l: 15.5 };

export interface PhotoStyle {
  size: Size;
  aspect: "4 / 5" | "1 / 1";
  r: number; // resting rotation (deg)
  sway: number; // wiggle amplitude (deg)
  lift: number; // wiggle lift (px)
  wd: number; // wiggle duration (s)
  deco: Deco; // washi tape, a heart pin, or nothing
}

/** Hand-picked mix of sizes, shapes, tilts and trims so no two neighbours look alike. */
export const PHOTO_STYLES: PhotoStyle[] = [
  { size: "l", aspect: "4 / 5", r: -4, sway: 1.5, lift: 4, wd: 6.2, deco: "tape" },
  { size: "m", aspect: "1 / 1", r: 5, sway: 1.4, lift: 5, wd: 7.1, deco: "pin" },
  { size: "m", aspect: "4 / 5", r: 3, sway: 1.2, lift: 4, wd: 6.8, deco: "none" },
  { size: "l", aspect: "1 / 1", r: -5, sway: 1.5, lift: 6, wd: 7.6, deco: "tape" },
  { size: "s", aspect: "4 / 5", r: 4, sway: 1.3, lift: 4, wd: 6.4, deco: "pin" },
  { size: "l", aspect: "4 / 5", r: -3, sway: 1.4, lift: 5, wd: 7.3, deco: "none" },
  { size: "m", aspect: "4 / 5", r: 5, sway: 1.2, lift: 4, wd: 6.6, deco: "tape" },
  { size: "s", aspect: "1 / 1", r: -4, sway: 1.6, lift: 6, wd: 7.9, deco: "none" },
  { size: "l", aspect: "4 / 5", r: -2, sway: 1.3, lift: 5, wd: 6.9, deco: "pin" },
  { size: "m", aspect: "1 / 1", r: 4, sway: 1.5, lift: 4, wd: 7.4, deco: "tape" },
  { size: "s", aspect: "4 / 5", r: -5, sway: 1.2, lift: 5, wd: 6.5, deco: "none" },
  { size: "m", aspect: "4 / 5", r: 6, sway: 1.4, lift: 4, wd: 7.7, deco: "pin" },
];

export const styleOf = (index: number): PhotoStyle => PHOTO_STYLES[index % PHOTO_STYLES.length]!;

export interface Placement {
  index: number; // photo index (0-based)
  group: Group;
  order: number; // reveal order
  col: number; // sub-column inside a side (desktop)
  widthPx: number; // desktop side photos: exact width; 0 = let CSS decide
  align: Align; // horizontal position inside its column
}

export interface DesktopArrangement {
  placements: Placement[];
  /** Sub-columns per side (1 or 2). */
  cols: number;
}

const FRAME_PX = 40; // polaroid padding (8 top + 32 bottom)
const GAP_PX = 22; // vertical gap between photos in a column
const OVERHANG_PX = 64; // photos may extend slightly past the letter's top/bottom
const SUB_GAP_PX = 18; // gap between two sub-columns on one side
const MIN_TWO_COL_PX = 170; // a sub-column narrower than this looks cramped
const MAX_COL_PX = 300; // never wider than this, even with lots of room

/** On-screen height of a photo in a column, including the gap below it. */
export function photoHeight(style: PhotoStyle, widthPx: number): number {
  const ratio = style.aspect === "4 / 5" ? 1.25 : 1;
  return (widthPx - 16) * ratio + FRAME_PX + GAP_PX;
}

export function sideColumns(sideWidthPx: number): { cols: number; colWidth: number } {
  const cols = sideWidthPx >= MIN_TWO_COL_PX * 2 + SUB_GAP_PX ? 2 : 1;
  const colWidth = Math.min(MAX_COL_PX, (sideWidthPx - SUB_GAP_PX * (cols - 1)) / cols);
  return { cols, colWidth: Math.max(0, Math.floor(colWidth)) };
}

export function arrangeStack(indices: number[]): Placement[] {
  return indices.map((index, i) => ({ index, group: i < 2 ? "top" : "bottom", order: i, col: 0, widthPx: 0, align: "center" }));
}

const ALIGN: Record<"left" | "right", Align[]> = { left: ["end", "start", "center"], right: ["start", "end", "center"] };

export function arrangeDesktop(indices: number[], letterHeightPx: number, sideWidthPx: number): DesktopArrangement {
  const { cols, colWidth } = sideColumns(sideWidthPx);
  const capacity = letterHeightPx + OVERHANG_PX;
  // Fill order alternates sides so both grow evenly: L0, R0, L1, R1.
  const columns: { side: "left" | "right"; col: number; used: number; count: number }[] = [];
  for (let c = 0; c < cols; c++) for (const side of ["left", "right"] as const) columns.push({ side, col: c, used: 0, count: 0 });

  const placed: Placement[] = [];
  const bottom: number[] = [];

  for (const index of indices) {
    const style = styleOf(index);
    const width = Math.round(colWidth * SIZE_FACTOR[style.size]);
    const h = photoHeight(style, width);
    // The emptiest column that still has room (stable for ties → fill order above).
    const target = colWidth > 0 ? [...columns].sort((a, b) => a.used - b.used).find((c) => c.used + h <= capacity) : undefined;
    if (!target) {
      bottom.push(index);
      continue;
    }
    const align = cols === 2 ? "center" : ALIGN[target.side][target.count % 3]!;
    placed.push({ index, group: target.side, order: placed.length, col: target.col, widthPx: width, align });
    target.used += h;
    target.count++;
  }

  for (const index of bottom) placed.push({ index, group: "bottom", order: placed.length, col: 0, widthPx: 0, align: "center" });
  return { placements: placed, cols };
}
