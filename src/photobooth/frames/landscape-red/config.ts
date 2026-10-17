import type { PhotoboothFrame } from "../types";

/**
 * Wide · Red — a wide "Love, Written." designer strip: a cream header with the name and the
 * website, then three photos in a row in a colored band. 3200 × 1160 px.
 * Built by scripts/photobooth/build-design-frames.mjs (keep the numbers in sync).
 */
const SLOT = { y: 304, width: 1034, height: 832 } as const;

const frame: PhotoboothFrame = {
  id: "landscape-red",
  name: "Wide · Red",
  description: "A wide strip — three photos in a row, red.",
  width: 3200,
  height: 1160,
  background: "#7d0a0a",
  slots: [
    { ...SLOT, x: 25 },
    { ...SLOT, x: 1083 },
    { ...SLOT, x: 2141 },
  ],
  gutter: 20,
  grayscale: false,
  overlay: "/photobooth/frames/landscape-red/frame.png",
  soloOverlay: "/photobooth/frames/landscape-red/frame-solo.png",
  preview: "/photobooth/frames/landscape-red/preview.png",
};

export default frame;
