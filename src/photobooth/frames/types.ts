/**
 * A photobooth frame = one strip design. See docs/PHOTOBOOTH_FRAMES.md for how to make one.
 *
 * Coordinates are in OUTPUT pixels (the final downloadable image), origin top-left.
 * Each of the 4 slots holds one moment: Person A's photo on the left, Person B's on the
 * right, separated by `gutter` pixels. The renderer fills slots with photos first, then
 * lays `overlay` (a PNG with transparent windows) on top.
 */
export interface PhotoSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhotoboothFrame {
  /** URL-safe id = folder name, e.g. "black-white". */
  id: string;
  name: string;
  /** One short line for the selector. */
  description: string;
  /** Final image size in px. */
  width: number;
  height: number;
  /** Color behind everything (shows through any part the overlay doesn't cover). */
  background: string;
  /** Exactly 4 slots, top to bottom (photo 1 → photo 4). */
  slots: [PhotoSlot, PhotoSlot, PhotoSlot, PhotoSlot];
  /** Space between Person A's and Person B's photo inside a slot. */
  gutter: number;
  /** Turn the photos black & white in the strip (the individual downloads stay in color). */
  grayscale: boolean;
  /** Overlay PNG under /public (transparent where photos show through), or null for none. */
  overlay: string | null;
  /** Small preview shown in the frame selector and on the landing page (under /public). */
  preview: string;
}
