import type { PhotoboothFrame } from "./types";
import blackWhite from "./black-white/config";

export type { PhotoboothFrame, PhotoSlot } from "./types";

/**
 * Every available photobooth frame, in selector order.
 * To add a frame: create its folder (see docs/PHOTOBOOTH_FRAMES.md), then add ONE import
 * and ONE entry here. Nothing else in the photobooth needs to change.
 */
export const FRAMES: readonly PhotoboothFrame[] = [blackWhite];

export const DEFAULT_FRAME_ID = FRAMES[0]!.id;

export function getFrame(id: string | null | undefined): PhotoboothFrame | undefined {
  return FRAMES.find((f) => f.id === id);
}

/** Sanity checks so a mistyped config fails loudly in tests instead of in a customer's strip. */
export function validateFrame(f: PhotoboothFrame): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9-]+$/.test(f.id)) problems.push("id must be lowercase letters, numbers and dashes");
  if (f.slots.length !== 4) problems.push("exactly 4 slots are required");
  for (const [i, s] of f.slots.entries()) {
    if (s.x < 0 || s.y < 0 || s.x + s.width > f.width || s.y + s.height > f.height) problems.push(`slot ${i + 1} is outside the image`);
    if ((s.width - f.gutter) / 2 < 200 || s.height < 200) problems.push(`slot ${i + 1} is too small`);
  }
  if (f.overlay && !f.overlay.startsWith("/photobooth/frames/")) problems.push("overlay must live under /public/photobooth/frames/");
  if (!f.preview.startsWith("/photobooth/frames/")) problems.push("preview must live under /public/photobooth/frames/");
  return problems;
}
