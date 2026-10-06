"use client";

/* eslint-disable @next/next/no-img-element -- locally generated data/blob images */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { useHydrated } from "@/lib/client/useHydrated";
import { heartQrSvg } from "@/lib/qr/heart-qr";

const EXPORT_SIZE = 1024;
const FILE_NAME = "love-written-surprise.png";

/**
 * A heart-shaped QR code for the surprise link, generated entirely in the browser.
 * Lets the customer share the surprise without showing the link itself — copy the
 * image, save it, or (on phones) share it straight to a chat.
 */
export function HeartQrCard({ url }: { url: string }) {
  const svg = useMemo(() => heartQrSvg(url).svg, [url]);
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg]);
  const hydrated = useHydrated();
  const canShareFiles = hydrated && typeof navigator.canShare === "function";
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<"copy" | "save" | "share" | null>(null);

  /** Render the SVG to a crisp PNG (works in chats that don't accept SVG). */
  async function toPng(): Promise<Blob> {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_SIZE;
    canvas.height = EXPORT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.drawImage(img, 0, 0, EXPORT_SIZE, EXPORT_SIZE);
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
  }

  function flash(message: string) {
    setStatus(message);
    setTimeout(() => setStatus(null), 2500);
  }

  async function copy() {
    setBusy("copy");
    try {
      // Pass the promise directly: Safari requires the clipboard write to start in the tap itself.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": toPng() })]);
      flash("Image copied — paste it into your chat ♥");
    } catch {
      flash("Your browser can't copy images — use Save instead.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy("save");
    try {
      const blob = await toPng();
      const href = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href, download: FILE_NAME });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      flash("Saved to your downloads");
    } catch {
      flash("Couldn't save the image. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    try {
      const file = new File([await toPng()], FILE_NAME, { type: "image/png" });
      if (!navigator.canShare?.({ files: [file] })) throw new Error("unsupported");
      await navigator.share({ files: [file], title: "A surprise for you 💌" });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) flash("Sharing isn't available here — use Save instead.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-[1.75rem] bg-[linear-gradient(160deg,#fde8ec,#fffdfa_70%)] p-6 ring-1 ring-blush">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <img
          src={src}
          alt="Heart-shaped QR code that opens your surprise"
          width={200}
          height={200}
          className="h-48 w-48 shrink-0 drop-shadow-[0_14px_24px_rgba(196,72,106,0.22)] sm:h-52 sm:w-52"
        />
        <div className="text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose">Share it as a heart</p>
          <h2 className="mt-2 font-display text-2xl">Keep the link a secret</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Send this heart instead of the link. When they scan it with their phone camera, the surprise opens.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button variant="secondary" className="px-4 py-2 text-sm" onClick={copy} busy={busy === "copy"} disabled={busy !== null}>
              <Icon.copy size={15} /> Copy image
            </Button>
            <Button variant="secondary" className="px-4 py-2 text-sm" onClick={save} busy={busy === "save"} disabled={busy !== null}>
              <Icon.image size={15} /> Save image
            </Button>
            {canShareFiles && (
              <Button className="px-4 py-2 text-sm" onClick={share} busy={busy === "share"} disabled={busy !== null}>
                <Icon.send size={15} /> Share
              </Button>
            )}
          </div>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-xs text-ink-soft">
            {status}
          </p>
        </div>
      </div>
    </div>
  );
}
