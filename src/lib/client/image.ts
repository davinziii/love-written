"use client";

import { UPLOAD_RULES } from "@/lib/media/sniff";

/**
 * Browser-side photo preparation so customers never compress anything themselves:
 * validate → decode (respecting EXIF rotation) → resize to ≤2400px → re-encode.
 * The server validates and re-encodes again; this step just saves bandwidth.
 */
export class ImagePrepError extends Error {}

const TARGET_MAX_BYTES = 3.5 * 1024 * 1024;

/** HEIC/HEIF (iPhone and some Android cameras) — detected by type, extension or file header. */
async function isHeic(file: File): Promise<boolean> {
  if (/^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return true;
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const box = String.fromCharCode(...head.slice(4, 12));
  return /^ftyp(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(box);
}

/**
 * Decode HEIC. Safari can do it natively; elsewhere (most Android/Chrome) we convert it in
 * the browser with heic2any, which is downloaded only when a HEIC photo is actually picked.
 */
async function decodeHeic(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const jpeg = Array.isArray(converted) ? converted[0]! : converted;
    return createImageBitmap(jpeg, { imageOrientation: "from-image" });
  }
}

export async function prepareImage(file: File): Promise<Blob> {
  const heic = await isHeic(file);
  if (!heic && file.type && !(UPLOAD_RULES.acceptedMime as readonly string[]).includes(file.type)) {
    throw new ImagePrepError("Please choose a JPG, PNG, WebP or HEIC photo.");
  }
  if (file.size > UPLOAD_RULES.maxOriginalBytes) {
    throw new ImagePrepError("That photo is larger than 10 MB. Please choose a smaller one.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = heic ? await decodeHeic(file) : await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImagePrepError(
      heic
        ? "We couldn't convert that HEIC photo. Try sharing it as a JPG, or pick a different photo."
        : "We couldn't read that photo. Please try a different one.",
    );
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
