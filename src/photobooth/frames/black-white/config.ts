import type { PhotoboothFrame } from "../types";

/**
 * Black & White — the classic photobooth strip: black paper, three moments stacked,
 * "Love, Written" printed at the bottom. 1200 × 2840 px.
 *
 *   ┌──────────────────────┐  y = 0
 *   │  [ A ]  ║  [ B ]     │  slot 1   y =   60 … 780
 *   │  [ A ]  ║  [ B ]     │  slot 2   y =  820 … 1540
 *   │  [ A ]  ║  [ B ]     │  slot 3   y = 1580 … 2300
 *   │    LOVE, WRITTEN     │  footer   y = 2300 … 2840
 *   └──────────────────────┘
 */
const SLOT = { x: 60, width: 1080, height: 720 } as const;

const frame: PhotoboothFrame = {
  id: "black-white",
  name: "Black",
  description: "Black paper, light lettering — the classic strip.",
  width: 1200,
  height: 2840,
  background: "#0b0b0b",
  slots: [
    { ...SLOT, y: 60 },
    { ...SLOT, y: 820 },
    { ...SLOT, y: 1580 },
  ],
  gutter: 20,
  grayscale: true,
  overlay: "/photobooth/frames/black-white/frame.png",
  soloOverlay: "/photobooth/frames/black-white/frame-solo.png",
  preview: "/photobooth/frames/black-white/preview.png",
};

export default frame;
