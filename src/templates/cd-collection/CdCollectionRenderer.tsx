"use client";

/* eslint-disable @next/next/no-img-element -- media is pre-optimized and served via signed URLs */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import type { RendererProps } from "../types";
import { BACKGROUNDS, MAX_CDS, MIN_CDS, type CdCollectionData } from "./definition";
import { layoutCollection, type CaseGeometry, type FaceTransform, type Layout } from "./geometry";
import { MemoryViewer, type Memory } from "./MemoryViewer";
import s from "./cd-collection.module.css";

/**
 * CD Collection — trusted renderer.
 *
 *   CDCollection (this component)  state: which CD is pulled out, which memory is open
 *   CDScene                        lays the row out with geometry.ts and fits it to the screen
 *   CDCase                         one jewel case: front, side, top + its fixed hit area
 *   CollectionControls             previous / next / open, for touch and keyboard
 *   MemoryViewer                   the opened memory
 *
 * Mouse: hover pulls a CD out, click opens it. Touch: first tap pulls it out, second tap
 * opens it, tapping elsewhere puts it back. A pulled-out case keeps its place in the stack —
 * it only slides sideways. Hit areas stay where the cases rest, so a case sliding out never
 * steals the pointer from under itself (no flicker).
 * It never checks payment, access, editing, expiry or storage.
 */

export function CdCollectionRenderer({ data, mode }: RendererProps<CdCollectionData>) {
  const fields = data as Record<string, string | undefined>;
  const memories: Memory[] = [];
  for (let n = 1; n <= MAX_CDS; n++) {
    const photo = fields[`cd_photo_${n}`];
    // Live: only CDs with a cover. Editor/catalog: the required ones show as placeholders.
    if (!photo && (mode === "live" || n > MIN_CDS)) continue;
    const title = fields[`cd_title_${n}`]?.trim();
    memories.push({
      n,
      photo,
      title: title || `Track ${memories.length + 1}`,
      named: Boolean(title),
      message: fields[`cd_message_${n}`]?.trim() ?? "",
    });
  }

  const [active, setActive] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);

  /** Pull a CD out (or none — the previous one slides back into its slot). */
  function select(i: number | null) {
    setActive(i);
  }

  function openMemory(i: number) {
    select(i);
    setOpen(i);
  }

  const bg = BACKGROUNDS.find((b) => b.id === data.background) ?? BACKGROUNDS[0];
  const title = data.collection_title?.trim() || "Our Memories";

  return (
    <div ref={rootRef} className={s.root} style={{ "--bg": bg.value } as CSSProperties} data-tone={bg.dark ? "dark" : "light"}>
      {open !== null && (
        <MemoryViewer
          memories={memories}
          index={open}
          onIndex={(i) => {
            setOpen(i);
            select(i);
          }}
          onClose={() => {
            setOpen(null);
            if (active !== null) sceneRef.current?.reveal(active);
          }}
          rootRef={rootRef}
        />
      )}

      <header className={s.header}>
        <h1 className={s.title}>{title}</h1>
        <p className={s.hint}>
          <span className={s.hintHover}>Hover a CD to pull it out · click to open</span>
          <span className={s.hintTouch}>Tap a CD to pull it out · tap again to open</span>
        </p>
      </header>

      <CDScene
        memories={memories}
        active={active}
        onSelect={select}
        onOpen={openMemory}
        handleRef={sceneRef}
      />

      <CollectionControls
        count={memories.length}
        active={active}
        onStep={(i) => {
          select(i);
          sceneRef.current?.reveal(i);
        }}
        onOpen={() => active !== null && openMemory(active)}
      />

      <footer className={s.footer}>
        <p>Made with ♥ by Love, Written</p>
        <p>
          <Link href="/" target={mode === "preview" ? "_blank" : undefined} rel="noopener">
            Make a surprise for someone →
          </Link>
        </p>
      </footer>
    </div>
  );
}

/* ─── The scene ──────────────────────────────────────────────────────────── */

interface SceneHandle {
  /** Scroll a CD into view (when the collection is bigger than the screen). */
  reveal: (i: number) => void;
}

function CDScene({
  memories,
  active,
  onSelect,
  onOpen,
  handleRef,
}: {
  memories: Memory[];
  active: number | null;
  onSelect: (i: number | null) => void;
  onOpen: (i: number) => void;
  handleRef: { current: SceneHandle | null };
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pointerType = useRef<string>("mouse");
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const count = memories.length;

  // Measure the stage. Its size never depends on what's drawn inside, so this can't loop.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const apply = (width: number, height: number) => {
      const w = Math.round(width);
      const h = Math.round(height);
      setSize((prev) => (prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    // Measure right away (the observer's first report only comes with the next rendered frame).
    apply(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(([entry]) => entry && apply(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout: Layout | null = useMemo(() => {
    if (!size || count === 0) return null;
    const narrow = size.width < 600;
    return layoutCollection(count, {
      width: size.width,
      height: size.height,
      // Room for the title above and the controls below.
      margin: narrow ? [72, 18, 96, 18] : [84, 56, 110, 56],
    });
  }, [size, count]);

  // When the collection is bigger than the screen, start at the front of the row.
  const startedFor = useRef<string | null>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !layout?.pan) return;
    const key = `${layout.width}x${layout.height}`;
    if (startedFor.current === key) return;
    startedFor.current = key;
    const [x, y] = layout.cases[0]!.center;
    el.scrollTo({ left: x - el.clientWidth / 2, top: y - el.clientHeight / 2 });
  }, [layout]);

  useEffect(() => {
    handleRef.current = {
      reveal: (i) => {
        const el = stageRef.current;
        const c = layout?.cases[i];
        if (!el || !c || !layout?.pan) return;
        const [x, y] = c.center;
        const inView = x > el.scrollLeft + 40 && x < el.scrollLeft + el.clientWidth - 40 && y > el.scrollTop + 60 && y < el.scrollTop + el.clientHeight - 100;
        if (inView) return;
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollTo({ left: x - el.clientWidth / 2, top: y - el.clientHeight / 2, behavior: smooth ? "smooth" : "auto" });
      },
    };
  });

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    pointerType.current = e.pointerType;
    // Tapping the empty studio puts the pulled-out CD back.
    if (!(e.target as HTMLElement).closest("[data-cd]")) onSelect(null);
  }

  return (
    <div
      ref={stageRef}
      className={s.stage}
      data-pan={layout?.pan ? "" : undefined}
      onPointerDown={onPointerDown}
      role="group"
      aria-label={`${count} CDs`}
    >
      {layout && (
        <div className={s.drawing} style={{ width: layout.width, height: layout.height }}>
          {/* Floor shadows go underneath every case. */}
          <div className={s.shadows} aria-hidden>
            {layout.cases.map((c, i) => (
              <Face
                key={i}
                face={c.shadow}
                className={s.shadow}
                data-active={i === active ? "" : undefined}
                offset={i === active ? c.extract : undefined}
              />
            ))}
          </div>
          {layout.cases.map((c, i) => (
            <CDCase
              key={memories[i]!.n}
              index={i}
              memory={memories[i]!}
              geometry={c}
              z={count - i}
              active={i === active}
              pointerType={pointerType}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── One jewel case ─────────────────────────────────────────────────────── */

function CDCase({
  index,
  memory,
  geometry,
  z,
  active,
  pointerType,
  onSelect,
  onOpen,
}: {
  index: number;
  memory: Memory;
  geometry: CaseGeometry;
  z: number;
  active: boolean;
  pointerType: { current: string };
  onSelect: (i: number | null) => void;
  onOpen: (i: number) => void;
}) {
  const hovers = (e: PointerEvent) => e.pointerType === "mouse" || e.pointerType === "pen";

  function onClick(e: MouseEvent) {
    // Touch: the first tap pulls the CD out, the second opens it. Mouse/keyboard: open.
    if (pointerType.current === "touch" && e.detail !== 0 && !active) onSelect(index);
    else onOpen(index);
  }

  return (
    <div
      className={s.cd}
      data-cd=""
      data-active={active ? "" : undefined}
      style={{ zIndex: z }}
      onPointerEnter={(e) => hovers(e) && onSelect(index)}
      onPointerLeave={(e) => hovers(e) && active && onSelect(null)}
      onClick={onClick}
    >
      {/* Fixed hit areas where the case rests — they never move, so hovering is stable. */}
      <Face face={geometry.top} className={s.hit} />
      <Face face={geometry.front} className={s.hit} as="button" label={`${memory.title}${active ? " — open" : ""}`} onFocus={() => onSelect(index)} />

      <div className={s.body} style={active ? { transform: `translate(${geometry.extract[0]}px, ${geometry.extract[1]}px)` } : undefined}>
        <Face face={geometry.top} className={s.top} />
        <Face face={geometry.right} className={s.side} />
        <Face face={geometry.front} className={s.front}>
          <span className={s.hinge} />
          <span className={s.art}>
            {memory.photo ? <img src={memory.photo} alt="" loading="lazy" decoding="async" draggable={false} /> : <span className={s.placeholder} />}
          </span>
          <span className={s.gloss} />
        </Face>
      </div>
    </div>
  );
}

function Face({
  face,
  className,
  offset,
  as,
  label,
  onFocus,
  children,
  ...rest
}: {
  face: FaceTransform;
  className: string | undefined;
  offset?: readonly [number, number] | undefined;
  as?: "button";
  label?: string;
  onFocus?: () => void;
  children?: ReactNode;
  "data-active"?: string | undefined;
}) {
  const style: CSSProperties = {
    width: face.width,
    height: face.height,
    transform: offset ? `translate(${offset[0]}px, ${offset[1]}px) ${face.matrix}` : face.matrix,
  };
  if (as === "button") {
    return <button type="button" className={className} style={style} aria-label={label} onFocus={onFocus} />;
  }
  return (
    <div className={className} style={style} {...rest}>
      {children}
    </div>
  );
}

/* ─── Controls ───────────────────────────────────────────────────────────── */

function CollectionControls({
  count,
  active,
  onStep,
  onOpen,
}: {
  count: number;
  active: number | null;
  onStep: (i: number) => void;
  onOpen: () => void;
}) {
  if (count === 0) return null;
  const at = active ?? -1;
  return (
    <div className={s.controls}>
      <button type="button" className={s.control} onClick={() => onStep(at <= 0 ? count - 1 : at - 1)} aria-label="Previous CD">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M14.5 5.5 8 12l6.5 6.5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button type="button" className={s.openButton} onClick={onOpen} disabled={active === null}>
        {active === null ? `${count} CDs` : "Open"}
      </button>
      <button type="button" className={s.control} onClick={() => onStep(at >= count - 1 ? 0 : at + 1)} aria-label="Next CD">
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M9.5 5.5 16 12l-6.5 6.5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
