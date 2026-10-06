"use client";

import { UPLOAD_RULES } from "@/lib/media/sniff";

/**
 * Browser-side photo preparation so customers never compress anything themselves:
 * validate → decode (respecting EXIF rotation) → resize to ≤2400px → re-encode.
 * The server validates and re-encodes again; this step just saves bandwidth.
 */
export class ImagePrepError extends Error {}

const TARGET_MAX_BYTES = 3.5 * 1024 * 1024;

export async function prepareImage(file: File): Promise<Blob> {
  if (file.type && !(UPLOAD_RULES.acceptedMime as readonly string[]).includes(file.type)) {
    throw new ImagePrepError("Please choose a JPG, PNG or WebP photo.");
  }
  if (file.size > UPLOAD_RULES.maxOriginalBytes) {
    throw new ImagePrepError("That photo is larger than 10 MB. Please choose a smaller one.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImagePrepError("We couldn't read that photo. Please try a different one.");
  }

  try {
    if (Math.min(bitmap.width, bitmap.height) < UPLOAD_RULES.minDimension) {
      throw new ImagePrepError("That photo is very small — please choose a larger one.");
    }
    const scale = Math.min(1, UPLOAD_RULES.maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImagePrepError("Your browser couldn't process that photo.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.86, 0.75, 0.62]) {
      let blob = await toBlob(canvas, "image/webp", quality);
      // Older Safari can't encode WebP and silently returns PNG — use JPEG there.
      if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
      if (blob && blob.size <= TARGET_MAX_BYTES) return blob;
    }
    throw new ImagePrepError("That photo is too detailed to upload. Please choose another.");
  } finally {
    bitmap.close();
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
