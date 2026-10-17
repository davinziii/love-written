import type { PhotoboothFrame } from "../types";

/**
 * Cream — a "Love, Written." designer strip: three photos stacked, the website along the
 * left edge, "Love, Written." at the bottom. 1200 × 3300 px.
 * Built by scripts/photobooth/build-design-frames.mjs (keep the numbers in sync).
 */
const SLOT = { x: 150, width: 990, height: 840 } as const;

const frame: PhotoboothFrame = {
  id: "cream",
  name: "Cream",
  description: "Cream paper, deep red lettering.",
  width: 1200,
  height: 3300,
  background: "#fdfcf5",
  slots: [
    { ...SLOT, y: 70 },
    { ...SLOT, y: 960 },
    { ...SLOT, y: 1850 },
  ],
  gutter: 20,
  grayscale: false,
  overlay: "/photobooth/frames/cream/frame.png",
  soloOverlay: "/photobooth/frames/cream/frame-solo.png",
  preview: "/photobooth/frames/cream/preview.png",
};

export default frame;
