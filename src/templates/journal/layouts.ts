/**
 * Journal — where the extra photos and the words sit on a page.
 *
 * Every page is one full photo; extra photos are pinned on top in white frames. Six
 * hand-placed arrangements; page n uses arrangement (n - 1) % 6, so neighbouring pages never
 * look alike. Each one keeps a free corner for the words. Positions are percentages of the
 * page (6:5), so they scale with it.
 */

export type Frame = "classic" | "polaroid" | "tape" | "rounded";
export type Corner = "tl" | "tr" | "bl" | "br";

export interface StickerSpot {
  /** Left / top edge, % of the page. */
  left: number;
  top: number;
  /** Width, % of the page width. */
  width: number;
  /** Tilt in degrees. */
  rotate: number;
  frame: Frame;
  /** Photo aspect ratio inside the frame (width / height). */
  aspect: number;
}

export interface PageLayout {
  stickers: readonly [StickerSpot, StickerSpot];
  /** Corner for the words when the page has extra photos. */
  words: Corner;
}

export const LAYOUTS: readonly PageLayout[] = [
  {
    stickers: [
      { left: 5, top: 7, width: 33, rotate: -6, frame: "classic", aspect: 4 / 3 },
      { left: 62, top: 9, width: 31, rotate: 5, frame: "classic", aspect: 4 / 3 },
    ],
    words: "bl",
  },
  {
    stickers: [
      { left: 61, top: 47, width: 29, rotate: 4, frame: "polaroid", aspect: 1 },
      { left: 7, top: 8, width: 24, rotate: -4, frame: "tape", aspect: 3 / 4 },
    ],
    words: "tr",
  },
  {
    stickers: [
      { left: 64, top: 7, width: 27, rotate: -3, frame: "rounded", aspect: 3 / 4 },
      { left: 9, top: 55, width: 30, rotate: 6, frame: "polaroid", aspect: 4 / 3 },
    ],
    words: "tl",
  },
  {
    stickers: [
      { left: 6, top: 50, width: 34, rotate: 3, frame: "tape", aspect: 4 / 3 },
      { left: 60, top: 8, width: 25, rotate: -7, frame: "polaroid", aspect: 1 },
    ],
    words: "br",
  },
  {
    stickers: [
      { left: 54, top: 47, width: 37, rotate: -3, frame: "tape", aspect: 4 / 3 },
      { left: 6, top: 6, width: 24, rotate: 5, frame: "rounded", aspect: 3 / 4 },
    ],
    words: "bl",
  },
  {
    stickers: [
      { left: 65, top: 6, width: 28, rotate: 4, frame: "classic", aspect: 3 / 4 },
      { left: 5, top: 49, width: 28, rotate: -5, frame: "polaroid", aspect: 1 },
    ],
    words: "br",
  },
];

export function layoutFor(pageNumber: number): PageLayout {
  return LAYOUTS[(pageNumber - 1) % LAYOUTS.length]!;
}
