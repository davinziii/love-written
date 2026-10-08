"use client";

/* eslint-disable @next/next/no-img-element -- local blob / signed URLs */

import { useRef } from "react";
import { Spinner } from "@/components/ui/Button";

export const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export interface ImageState {
  url?: string;
  uploading?: boolean;
  error?: string;
}

export function ImageFieldControl({
  id,
  label,
  state,
  disabled,
  required,
  onSelect,
  onRemove,
}: {
  id: string;
  label: string;
  state?: ImageState;
  disabled?: boolean;
  required: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = Boolean(state?.uploading);

  return (
    // Paste a copied photo while this control (or its button) is focused.
    <div
      onPaste={(e) => {
        const file = [...e.clipboardData.files].find((f) => f.type.startsWith("image/"));
        if (!file || disabled || busy) return;
        e.preventDefault();
        onSelect(file);
      }}
    >
      <input
        ref={inputRef}
        id={id}
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
      {state?.url ? (
        <div className="flex items-center gap-4 rounded-2xl bg-white p-3 ring-1 ring-line">
          <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-cream">
            <img src={state.url} alt={`Selected photo for ${label}`} className="h-full w-full object-cover" />
            {busy && (
              <span className="absolute inset-0 grid place-items-center bg-white/70 text-rose">
                <Spinner />
              </span>
            )}
          </div>
          <div className="flex flex-1 flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-cream px-4 py-2 text-sm font-medium ring-1 ring-line hover:ring-ink/30 disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Replace"}
            </button>
            {!required && (
              <button
                type="button"
                disabled={disabled || busy}
                onClick={onRemove}
                className="rounded-full px-4 py-2 text-sm text-ink-soft hover:text-danger disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white px-4 py-7 text-sm text-ink-soft transition hover:border-rose hover:text-ink disabled:opacity-60"
        >
          {busy ? <Spinner className="text-rose" /> : <span className="text-2xl text-rose" aria-hidden>＋</span>}
          <span className="font-medium text-ink">{busy ? "Uploading…" : "Upload photo"}</span>
          <span className="text-xs">JPG, PNG, WebP or HEIC · up to 10 MB · we optimize it for you</span>
        </button>
      )}
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}
