import type { PhotoboothFrame } from "../types";

/**
 * Noir — a "Love, Written." designer strip: three photos stacked, the website along the
 * left edge, "Love, Written." at the bottom. 1200 × 3300 px.
 * Built by scripts/photobooth/build-design-frames.mjs (keep the numbers in sync).
 */
const SLOT = { x: 150, width: 990, height: 840 } as const;

const frame: PhotoboothFrame = {
  id: "noir",
  name: "Noir",
  description: "Black paper, white lettering.",
  width: 1200,
  height: 3300,
  background: "#0b0b0b",
  slots: [
    { ...SLOT, y: 70 },
    { ...SLOT, y: 960 },
    { ...SLOT, y: 1850 },
  ],
  gutter: 20,
  grayscale: true,
  overlay: "/photobooth/frames/noir/frame.png",
  soloOverlay: "/photobooth/frames/noir/frame-solo.png",
  preview: "/photobooth/frames/noir/preview.png",
};

export default frame;
