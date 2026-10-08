import type { PhotoboothFrame } from "../types";

/**
 * White — the same classic strip on white paper with dark lettering.
 * Same layout as Black & White (1200 × 3600, four slots, A left / B right).
 */
const SLOT = { x: 60, width: 1080, height: 720 } as const;

const frame: PhotoboothFrame = {
  id: "white",
  name: "White",
  description: "Light paper, dark lettering.",
  width: 1200,
  height: 3600,
  background: "#f7f4ee",
  slots: [
    { ...SLOT, y: 60 },
    { ...SLOT, y: 820 },
    { ...SLOT, y: 1580 },
    { ...SLOT, y: 2340 },
  ],
  gutter: 20,
  grayscale: false,
  overlay: "/photobooth/frames/white/frame.png",
  preview: "/photobooth/frames/white/preview.png",
};

export default frame;
