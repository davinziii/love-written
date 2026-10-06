import "server-only";
import sharp from "sharp";
import { ApiError, Errors } from "@/lib/errors";
import { detectImageKind, UPLOAD_RULES } from "./sniff";

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Validate and re-encode an uploaded image on the server.
 * Re-encoding guarantees the stored file is a real image, strips EXIF/GPS metadata
 * and enforces the size policy even if browser compression was bypassed.
 */
export async function processImage(input: Uint8Array): Promise<ProcessedImage> {
  if (input.byteLength > UPLOAD_RULES.maxUploadBytes) {
    throw Errors.badRequest("That photo is too large. Please choose one under 10 MB.");
  }
  if (!detectImageKind(input)) {
    throw Errors.badRequest("Please upload a JPG, PNG or WebP photo.");
  }

  try {
    const image = sharp(input, { limitInputPixels: UPLOAD_RULES.maxInputPixels, failOn: "error" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) throw new Error("no dimensions");
    if (Math.min(meta.width, meta.height) < UPLOAD_RULES.minDimension) {
      throw Errors.badRequest("That photo is very small — please choose a larger one.");
    }

    const { data, info } = await image
      .rotate() // apply EXIF orientation before metadata is dropped
      .resize({
        width: UPLOAD_RULES.maxDimension,
        height: UPLOAD_RULES.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return { buffer: data, width: info.width, height: info.height, bytes: info.size };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw Errors.badRequest("We couldn't read that photo. Please try a different one.");
  }
}
