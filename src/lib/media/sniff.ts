/**
 * Detect the real image type from magic bytes. The browser-provided MIME type and
 * filename are never trusted.
 */
export type ImageKind = "jpeg" | "png" | "webp";

export const UPLOAD_RULES = {
  /** Original file the customer picks (checked in the browser before compression). */
  maxOriginalBytes: 10 * 1024 * 1024,
  /** What the server accepts after browser compression. */
  maxUploadBytes: 4 * 1024 * 1024,
  /** Longest edge of the stored image. */
  maxDimension: 2400,
  /** Reject images smaller than this on either edge. */
  minDimension: 200,
  /** Guard against decompression bombs. */
  maxInputPixels: 60_000_000,
  acceptedMime: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}
