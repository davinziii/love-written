import { afterEach, describe, expect, it, vi } from "vitest";
import { ImagePrepError, prepareImage } from "@/lib/client/image";

// A damaged photo can make the browser's decoder never answer. Simulate exactly that.
const neverDecodes = () => new Promise<never>(() => undefined);
const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8])], "photo.jpg", { type: "image/jpeg" });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("preparing a photo that never decodes", () => {
  it("gives up after 30 seconds with a message the customer can read", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("createImageBitmap", neverDecodes);
    const result = prepareImage(photo());
    const check = expect(result).rejects.toBeInstanceOf(ImagePrepError);
    await vi.advanceTimersByTimeAsync(30_000);
    await check;
    await expect(result).rejects.toThrow(/damaged/);
  });

  it("stops at once when the customer cancels", async () => {
    vi.stubGlobal("createImageBitmap", neverDecodes);
    const ctrl = new AbortController();
    const result = prepareImage(photo(), ctrl.signal);
    ctrl.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });

  it("refuses to start when already cancelled", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(prepareImage(photo(), ctrl.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
