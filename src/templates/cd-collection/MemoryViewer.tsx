"use client";

/* eslint-disable @next/next/no-img-element -- media is pre-optimized and served via signed URLs */

import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import s from "./cd-collection.module.css";

export interface Memory {
  n: number;
  photo: string | undefined;
  title: string;
  /** The customer named this CD (otherwise the title is just "Track n"). */
  named: boolean;
  message: string;
}

const SWIPE_PX = 45;
const CLOSE_MS = 200;

/**
 * One memory, full screen: photo, title, message, previous / next, close.
 * Mouse, tap, swipe, arrow keys and Escape. While it is open the page behind it can't
 * scroll — the editor preview's scroller, or the page itself when live.
 */
export function MemoryViewer({
  memories,
  index,
  onIndex,
  onClose,
  rootRef,
}: {
  memories: Memory[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const [closing, setClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const memory = memories[index]!;
  const many = memories.length > 1;

  const latest = useRef({ step, close });
  useEffect(() => {
    latest.current = { step, close };
  });

  function step(dir: 1 | -1) {
    if (!many || closing) return;
    onIndex((index + dir + memories.length) % memories.length);
  }

  function close() {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return onClose();
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }

  useEffect(() => {
    const scroller = rootRef.current?.closest<HTMLElement>("[data-lw-scroll]") ?? document.documentElement;
    const previous = scroller.style.overflow;
    scroller.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") latest.current.close();
      else if (e.key === "ArrowRight") latest.current.step(1);
      else if (e.key === "ArrowLeft") latest.current.step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      scroller.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [rootRef]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1);
  }

  return (
    <div className={s.viewerLayer}>
      <div className={s.viewer} data-closing={closing ? "" : undefined} role="dialog" aria-modal="true" aria-labelledby="cd-viewer-title">
        <div className={s.viewerBar}>
          <button ref={closeRef} type="button" className={s.viewerClose} onClick={close} aria-label="Close">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <span className={s.viewerCount}>{many ? `${index + 1} / ${memories.length}` : ""}</span>
        </div>

        <div className={s.viewerBody}>
          <div
            className={s.viewerStage}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipe.current = null)}
          >
            {memory.photo ? (
              <img
                key={memory.n}
                className={s.viewerPhoto}
                src={memory.photo}
                alt={memory.title}
                decoding="async"
                draggable={false}
                onLoad={(e) => e.currentTarget.setAttribute("data-loaded", "")}
              />
            ) : (
              <span className={s.viewerPlaceholder} />
            )}
            {many && (
              <>
                <button type="button" className={`${s.viewerNav} ${s.viewerPrev}`} onClick={() => step(-1)} aria-label="Previous memory">
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </button>
                <button type="button" className={`${s.viewerNav} ${s.viewerNext}`} onClick={() => step(1)} aria-label="Next memory">
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </button>
              </>
            )}
          </div>

          <div className={s.viewerText} key={`t${memory.n}`}>
            {memory.named && <p className={s.viewerTrack}>Track {String(index + 1).padStart(2, "0")}</p>}
            <h2 id="cd-viewer-title" className={s.viewerTitle}>
              {memory.title}
            </h2>
            {memory.message && <p className={s.viewerMessage}>{memory.message}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
