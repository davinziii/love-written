import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import { ApiError, Errors } from "@/lib/errors";
import { detectImageKind } from "@/lib/media/sniff";
import type { PhotoboothFrame } from "@/photobooth/frames";

/** Captured stills are ~900×1200; anything far outside this isn't a photobooth capture. */
const MAX_SHOT_BYTES = 4 * 1024 * 1024;
const MIN_SHOT_EDGE = 240;
const MAX_SHOT_EDGE = 4000;
const STORED_MAX_EDGE = 1200;

/**
 * Validate a captured photo and re-encode it. Re-encoding guarantees the stored file is a
 * real image (never trusts the extension or declared type) and strips any metadata.
 */
export async function processShot(input: Uint8Array): Promise<Buffer> {
  if (input.byteLength === 0 || input.byteLength > MAX_SHOT_BYTES) throw Errors.badRequest("That photo couldn't be saved. Let's try again.");
  if (!detectImageKind(input)) throw Errors.badRequest("That photo couldn't be read. Let's try again.");
  try {
    const image = sharp(input, { limitInputPixels: 24_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) throw new Error("no dimensions");
    const short = Math.min(meta.width, meta.height);
    const long = Math.max(meta.width, meta.height);
    if (short < MIN_SHOT_EDGE || long > MAX_SHOT_EDGE) throw Errors.badRequest("That photo couldn't be saved. Let's try again.");
    return await image
      .rotate()
      .resize({ width: STORED_MAX_EDGE, height: STORED_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw Errors.badRequest("That photo couldn't be read. Let's try again.");
  }
}

/** Frame overlays ship with the app (public/), bundled into the server via outputFileTracingIncludes. */
async function readPublicAsset(publicPath: string): Promise<Buffer> {
  const safe = path.normalize(publicPath).replace(/^([/\\])+/, "");
  if (!safe.startsWith(path.join("photobooth", "frames"))) throw new Error("frame asset outside photobooth/frames");
  return readFile(path.join(process.cwd(), "public", safe));
}

export interface RoundPhotos {
  round: number;
  a: Buffer;
  b: Buffer;
}

async function fit(photo: Buffer, width: number, height: number, grayscale: boolean): Promise<Buffer> {
  let img = sharp(photo).resize(width, height, { fit: "cover", position: "attention" });
  if (grayscale) img = img.grayscale();
  return img.toBuffer();
}

/**
 * The final strip: photos go into the frame's slots (A left, B right), then the overlay on
 * top. Everything comes from the frame config — no frame is special-cased here.
 */
export async function composeStrip(
  frame: PhotoboothFrame,
  rounds: RoundPhotos[],
  { grayscale = frame.grayscale }: { grayscale?: boolean } = {},
): Promise<Buffer> {
  if (rounds.length !== frame.slots.length) throw new Error(`expected ${frame.slots.length} rounds, got ${rounds.length}`);
  const layers: OverlayOptions[] = [];
  for (const [i, slot] of frame.slots.entries()) {
    const r = rounds[i]!;
    const leftW = Math.floor((slot.width - frame.gutter) / 2);
    const rightW = slot.width - frame.gutter - leftW;
    layers.push(
      { input: await fit(r.a, leftW, slot.height, grayscale), left: slot.x, top: slot.y },
      { input: await fit(r.b, rightW, slot.height, grayscale), left: slot.x + leftW + frame.gutter, top: slot.y },
    );
  }
  if (frame.overlay) {
    const overlay = await sharp(await readPublicAsset(frame.overlay)).resize(frame.width, frame.height, { fit: "fill" }).png().toBuffer();
    layers.push({ input: overlay, left: 0, top: 0 });
  }
  return sharp({ create: { width: frame.width, height: frame.height, channels: 3, background: frame.background } })
    .composite(layers)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

/** One downloadable "Photo n": both people side by side, in color. */
export async function composePair(r: RoundPhotos): Promise<Buffer> {
  const w = 900;
  const h = 1200;
  const gap = 24;
  const [a, b] = await Promise.all([fit(r.a, w, h, false), fit(r.b, w, h, false)]);
  return sharp({ create: { width: w * 2 + gap * 3, height: h + gap * 2, channels: 3, background: "#ffffff" } })
    .composite([
      { input: a, left: gap, top: gap },
      { input: b, left: w + gap * 2, top: gap },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}
