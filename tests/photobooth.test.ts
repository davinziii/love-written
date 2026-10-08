import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { FRAMES, getFrame, validateFrame, DEFAULT_FRAME_ID } from "@/photobooth/frames";
import { composePair, composeStrip, processShot } from "@/lib/photobooth/images";
import { PHOTOBOOTH_RETENTION_DAYS, PHOTOBOOTH_ROUNDS } from "@/lib/photobooth/constants";

const photo = (color: string) =>
  sharp({ create: { width: 900, height: 1200, channels: 3, background: color } })
    .jpeg()
    .toBuffer();

describe("photobooth frames", () => {
  it("every frame config is valid", () => {
    for (const f of FRAMES) expect(validateFrame(f), f.id).toEqual([]);
  });
  it("frame ids are unique and the default exists", () => {
    expect(new Set(FRAMES.map((f) => f.id)).size).toBe(FRAMES.length);
    expect(getFrame(DEFAULT_FRAME_ID)).toBeDefined();
    expect(getFrame("nope")).toBeUndefined();
  });
  it("V1 rules: 4 photos, 7 days", () => {
    expect(PHOTOBOOTH_ROUNDS).toBe(4);
    expect(PHOTOBOOTH_RETENTION_DAYS).toBe(7);
  });
});

describe("photobooth images", () => {
  it("composes a real strip at the frame's size, photos inside the slots", async () => {
    const frame = getFrame("black-white")!;
    const rounds = await Promise.all([1, 2, 3, 4].map(async (round) => ({ round, a: await photo("#ff0000"), b: await photo("#0000ff") })));
    const strip = await composeStrip(frame, rounds);
    const meta = await sharp(strip).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([frame.width, frame.height]);

    // Middle of A's half of slot 1 is a photo (grey once B&W), not the black frame.
    const slot = frame.slots[0];
    const { data } = await sharp(strip)
      .extract({ left: slot.x + 100, top: slot.y + 300, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(40);
    expect(data[0]).toBe(data[1]); // grayscale
  });

  it("uses the chosen filter: color keeps color, B&W turns grey", async () => {
    const frame = getFrame("white")!;
    const rounds = await Promise.all([1, 2, 3, 4].map(async (round) => ({ round, a: await photo("#ff0000"), b: await photo("#0000ff") })));
    const slot = frame.slots[0];
    const pixel = async (buf: Buffer) =>
      (await sharp(buf).extract({ left: slot.x + 100, top: slot.y + 300, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true })).data;
    const color = await pixel(await composeStrip(frame, rounds, { grayscale: false }));
    expect(color[0]).toBeGreaterThan(200); // red stays red
    expect(color[2]).toBeLessThan(60);
    const bw = await pixel(await composeStrip(frame, rounds, { grayscale: true }));
    expect(bw[0]).toBe(bw[2]);
  });

  it("rejects the wrong number of photos", async () => {
    await expect(composeStrip(getFrame("black-white")!, [])).rejects.toThrow();
  });

  it("makes a side-by-side colour pair for downloads", async () => {
    const pair = await composePair({ round: 1, a: await photo("#ff0000"), b: await photo("#0000ff") });
    const meta = await sharp(pair).metadata();
    expect(meta.width! > meta.height!).toBe(true);
  });

  it("accepts a real capture and re-encodes it as JPEG", async () => {
    const out = await processShot(new Uint8Array(await photo("#336699")));
    expect((await sharp(out).metadata()).format).toBe("jpeg");
  });

  it("rejects things that aren't photos, tiny images and oversized files", async () => {
    await expect(processShot(new TextEncoder().encode("<svg onload=alert(1)>"))).rejects.toThrow();
    const tiny = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#fff" } }).png().toBuffer();
    await expect(processShot(new Uint8Array(tiny))).rejects.toThrow();
    await expect(processShot(new Uint8Array(5 * 1024 * 1024))).rejects.toThrow();
  });
});
