import type { PhotoboothFrame } from "../types";

/**
 * Black & White — the classic photobooth strip: black paper, four moments stacked,
 * "Love, Written" printed at the bottom. 1200 × 3600 px (a 2 × 6 in strip at 600 dpi).
 *
 *   ┌──────────────────────┐  y = 0
 *   │  [ A ]  ║  [ B ]     │  slot 1   y =   60 … 780
 *   │  [ A ]  ║  [ B ]     │  slot 2   y =  820 … 1540
 *   │  [ A ]  ║  [ B ]     │  slot 3   y = 1580 … 2300
 *   │  [ A ]  ║  [ B ]     │  slot 4   y = 2340 … 3060
 *   │    LOVE, WRITTEN     │  footer   y = 3060 … 3600
 *   └──────────────────────┘
 */
const SLOT = { x: 60, width: 1080, height: 720 } as const;

const frame: PhotoboothFrame = {
  id: "black-white",
  name: "Black & White",
  description: "The classic strip — four moments in black and white.",
  width: 1200,
  height: 3600,
  background: "#0b0b0b",
  slots: [
    { ...SLOT, y: 60 },
    { ...SLOT, y: 820 },
    { ...SLOT, y: 1580 },
    { ...SLOT, y: 2340 },
  ],
  gutter: 20,
  grayscale: true,
  overlay: "/photobooth/frames/black-white/frame.png",
  preview: "/photobooth/frames/black-white/preview.png",
};

export default frame;
