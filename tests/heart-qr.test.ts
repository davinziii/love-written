import { describe, expect, it } from "vitest";
import sharp from "sharp";
import jsQR from "jsqr";
import { heartQrSvg } from "@/lib/qr/heart-qr";

/** Render the heart QR like a phone would see it and decode it with an independent reader. */
async function decode(svg: string, px: number, blur = 0): Promise<string | null> {
  let img = sharp(Buffer.from(svg), { density: 300 }).resize(px, px).flatten({ background: "#ffffff" });
  if (blur) img = img.blur(blur);
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data ?? null;
}

const LINKS = [
  "https://love-written.vercel.app/s/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde",
  "http://localhost:3000/s/Zz9_-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abc",
  "https://a-much-longer-custom-domain-name.com/s/q7K2mQpL8Vf3xYz0123456789_-AbCdEfGhIjKlMnOpQ",
];

describe("heart-shaped QR code", () => {
  for (const url of LINKS) {
    it(`scans at small, medium and large sizes: ${url.slice(0, 40)}…`, async () => {
      const { svg } = heartQrSvg(url);
      for (const px of [240, 400, 1024]) expect(await decode(svg, px)).toBe(url);
      expect(await decode(svg, 320, 1)).toBe(url); // slightly out-of-focus camera
    });
  }

  it("is deterministic for the same link", () => {
    expect(heartQrSvg(LINKS[0]!).svg).toBe(heartQrSvg(LINKS[0]!).svg);
  });

  it("contains only shapes — no text, scripts or external references", () => {
    const { svg } = heartQrSvg(LINKS[0]!);
    expect(svg).not.toMatch(/<script|<text|href=|love-written\.vercel/i);
  });
});
