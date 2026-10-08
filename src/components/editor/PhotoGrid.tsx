"use client";

/* eslint-disable @next/next/no-img-element -- local blob / signed URLs */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Spinner } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import type { FieldDef } from "@/templates/types";
import { ACCEPTED_IMAGES, type ImageState } from "./ImageFieldControl";

/**
 * A group of photo fields as a compact grid of tiles, so many photos fit on one screen.
 * Besides tapping a tile to upload, photos can be pasted (Ctrl/⌘+V anywhere outside a
 * text box, or the Paste button on phones) and dropped onto a tile. Pasted photos go to
 * the focused tile, otherwise to the next empty spots. Uses only browser built-ins.
 */
export function PhotoGrid({
  fields,
  images,
  errors,
  disabled,
  onSelect,
  onRemove,
}: {
  fields: FieldDef[];
  images: Record<string, ImageState>;
  errors: Record<string, string | undefined>;
  disabled?: boolean;
  onSelect: (field: FieldDef, file: File) => void;
  onRemove: (field: FieldDef) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Only offer the Paste button where the browser can read images from the clipboard.
  const canReadClipboard = useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.clipboard?.read === "function",
    () => false,
  );

  const filled = fields.filter((f) => images[f.id]?.url).length;

  /** Put pasted/dropped images into the focused tile (if any), then the next empty ones. */
  function place(files: File[], startAt?: string) {
    const photos = files.filter((f) => f.type.startsWith("image/"));
    if (!photos.length) {
      setNotice("That isn't a photo. Copy an image, then paste again.");
      return;
    }
    const empty = fields.filter((f) => !images[f.id]?.url && !images[f.id]?.uploading);
    const start = startAt ? fields.find((f) => f.id === startAt) : undefined;
    const targets = start ? [start, ...empty.filter((f) => f.id !== start.id)] : empty;
    if (!targets.length) {
      setNotice("Every spot has a photo. Select one first, then paste to replace it.");
      return;
    }
    const pairs = photos.slice(0, targets.length).map((file, i) => [targets[i]!, file] as const);
    pairs.forEach(([field, file]) => onSelect(field, file));
    setNotice(pairs.length === 1 ? `Added to ${pairs[0]![0].label}.` : `Added ${pairs.length} photos.`);
  }

  function focusedTile(): string | undefined {
    const el = document.activeElement as HTMLElement | null;
    if (!el || !gridRef.current?.contains(el)) return undefined;
    return el.closest<HTMLElement>("[data-photo-field]")?.dataset.photoField;
  }

  // Ctrl/⌘+V anywhere on the page (except while typing) pastes into this grid.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (disabled || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (!files.some((f) => f.type.startsWith("image/"))) return;
      e.preventDefault();
      place(files, focusedTile());
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  async function pasteFromButton() {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        files.push(new File([blob], `pasted.${type.split("/")[1] ?? "png"}`, { type }));
      }
      if (!files.length) setNotice("No photo on your clipboard. Copy a photo first (long-press it → Copy).");
      else place(files);
    } catch {
      setNotice("Couldn't read your clipboard. Allow pasting, or tap a spot to upload instead.");
    }
  }

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-soft">
          {filled} of {fields.length} added · tap a spot to upload, or copy a photo and paste it here
          <span className="hidden sm:inline"> (Ctrl+V / ⌘V)</span>.
        </p>
        {canReadClipboard && (
          <button
            type="button"
            disabled={disabled}
            onClick={pasteFromButton}
            className="lw-press inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium ring-1 ring-line hover:text-rose hover:ring-rose disabled:opacity-50"
          >
            <Icon.clipboard size={14} /> Paste photo
          </button>
        )}
      </div>
      <div ref={gridRef} className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-x-3 gap-y-4">
        {fields.map((field) => (
          <PhotoTile
            key={field.id}
            field={field}
            state={images[field.id]}
            error={errors[field.id]}
            disabled={disabled}
            onSelect={(file) => onSelect(field, file)}
            onDrop={(files) => place(files, field.id)}
            onRemove={() => onRemove(field)}
          />
        ))}
      </div>
      <p aria-live="polite" className="min-h-4 text-xs font-medium text-rose">
        {notice}
      </p>
    </div>
  );
}

const noSubscribe = () => () => {};

/** One photo spot: tap to upload, drop a photo on it, or paste while it's selected. */
export function PhotoTile({
  field,
  state,
  error,
  disabled,
  caption,
  onSelect,
  onDrop,
  onRemove,
}: {
  field: FieldDef;
  /** Text under the tile (defaults to the field's label; "" hides it). */
  caption?: string;
  state?: ImageState;
  error?: string;
  disabled?: boolean;
  onSelect: (file: File) => void;
  onDrop: (files: File[]) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const busy = Boolean(state?.uploading);
  const message = state?.error ?? error;

  return (
    <div
      data-photo-field={field.id}
      data-field={field.id}
      className="min-w-0"
      onPaste={(e) => {
        const files = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/"));
        if (!files.length || disabled || busy) return;
        e.preventDefault();
        onDrop(files);
      }}
    >
      <input
        ref={inputRef}
        id={`field-${field.id}`}
        type="file"
        accept={ACCEPTED_IMAGES}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow picking the same file again after an error
          if (file) onSelect(file);
        }}
      />
      <div className="relative">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            if (disabled) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!disabled) onDrop([...e.dataTransfer.files]);
          }}
          aria-label={`${field.label}: ${state?.url ? "replace photo" : "add photo"}`}
          className={`group relative block aspect-square w-full overflow-hidden rounded-2xl transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose/40 disabled:cursor-not-allowed ${
            state?.url
              ? "bg-cream ring-1 ring-line"
              : `border-2 border-dashed bg-white ${message ? "border-danger/60" : "border-line"} hover:border-rose`
          } ${over ? "ring-4 ring-rose/40" : ""}`}
        >
          {state?.url ? (
            <>
              <img src={state.url} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-2 pb-1.5 pt-5 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                Replace
              </span>
            </>
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-1 text-ink-soft">
              <span className="text-xl leading-none text-rose" aria-hidden>
                ＋
              </span>
              <span className="text-[11px] font-medium">Add</span>
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-white/70 text-rose">
              <Spinner />
            </span>
          )}
        </button>
        {!field.required && state?.url && !busy && (
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            aria-label={`Remove ${field.label}`}
            className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-white text-ink-soft shadow ring-1 ring-line hover:text-danger"
          >
            <Icon.close size={12} />
          </button>
        )}
      </div>
      {caption !== "" && (
        <p className="mt-1 text-center text-[11px] leading-tight text-ink-soft">
          {caption ?? field.label}
          {field.required ? <span className="text-rose"> *</span> : <span className="block">(optional)</span>}
        </p>
      )}
      {message && (
        <p role="alert" className="mt-0.5 text-center text-[11px] leading-tight text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
