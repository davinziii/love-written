"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CAPTURE_HEIGHT, CAPTURE_WIDTH } from "@/lib/photobooth/constants";
import type { CameraIssue } from "@/lib/photobooth/types";

export type CameraStatus = "idle" | "starting" | "ready" | "error";

/**
 * The local camera. Video never leaves this browser — only captured stills are uploaded.
 * Front camera preferred; the stream is stopped when the page goes away.
 */
export function useCamera() {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [issue, setIssue] = useState<CameraIssue | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setStatus("idle");
  }, []);

  const start = useCallback(async (): Promise<CameraIssue | null> => {
    if (stream.current?.active) {
      setStatus("ready");
      return null;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setIssue("unsupported");
      setStatus("error");
      return "unsupported";
    }
    setStatus("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
      });
      stream.current = s;
      // If another app grabs the camera (or it's unplugged), say so instead of freezing.
      s.getVideoTracks()[0]?.addEventListener("ended", () => {
        stream.current = null;
        setIssue("unavailable");
        setStatus("error");
      });
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => undefined);
      }
      setIssue(null);
      setStatus("ready");
      return null;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      const kind: CameraIssue =
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError"
            ? "unavailable"
            : name === "NotReadableError" || name === "TrackStartError" || name === "AbortError"
              ? "in_use"
              : "other";
      setIssue(kind);
      setStatus("error");
      return kind;
    }
  }, []);

  /** Ref callback for whichever <video> is on screen right now. */
  const attach = useCallback((el: HTMLVideoElement | null) => {
    video.current = el;
    if (el && stream.current && el.srcObject !== stream.current) {
      el.srcObject = stream.current;
      void el.play().catch(() => undefined);
    }
  }, []);

  /** Grab a 3:4 still from the live preview (un-mirrored, like a real photobooth print). */
  const capture = useCallback(async (): Promise<Blob | null> => {
    const v = video.current;
    if (!v || !stream.current?.active || !v.videoWidth || !v.videoHeight) return null;
    const target = CAPTURE_WIDTH / CAPTURE_HEIGHT;
    const source = v.videoWidth / v.videoHeight;
    const sw = source > target ? v.videoHeight * target : v.videoWidth;
    const sh = source > target ? v.videoHeight : v.videoWidth / target;
    const canvas = document.createElement("canvas");
    canvas.width = CAPTURE_WIDTH;
    canvas.height = CAPTURE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  }, []);

  // Never leave the camera running after the page is gone.
  useEffect(() => {
    const onHide = () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setStatus("idle");
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { status, issue, start, stop, attach, capture };
}

export type Camera = ReturnType<typeof useCamera>;
