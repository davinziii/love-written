"use client";

import { useRef, type ReactNode } from "react";
import { EmojiPicker } from "./EmojiPicker";
import type { FieldDef } from "@/templates/types";
import { FONTS, getTheme, MUSIC_LIBRARY, NO_MUSIC, type Font } from "@/templates/styles";
import { ImageFieldControl, type ImageState } from "./ImageFieldControl";

/**
 * Renders the right control for a field TYPE. It knows nothing about any template —
 * adding a template never requires touching this file.
 */
export interface FieldControlProps {
  field: FieldDef;
  value: string | undefined;
  image?: ImageState;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
}

const inputClass =
  "w-full rounded-2xl border border-line bg-white px-4 py-3 text-[0.98rem] text-ink placeholder:text-ink-soft/50 focus:border-rose focus:outline-none focus:ring-4 focus:ring-rose/10 disabled:bg-cream";

export function FieldControl(props: FieldControlProps) {
  const { field, value, error, disabled, onChange } = props;
  const id = `field-${field.id}`;
  const describedBy = [field.help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Insert an emoji at the cursor (or replace the selection), keeping within maxLength. */
  function insertEmoji(emoji: string) {
    if (field.type !== "textarea") return;
    const el = textareaRef.current;
    const current = value ?? "";
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + emoji + current.slice(end);
    if (next.length > field.maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  }

  let control: ReactNode;
  switch (field.type) {
    case "text":
      control = (
        <input
          id={id}
          type="text"
          className={inputClass}
          value={value ?? ""}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "textarea":
      control = (
        <textarea
          ref={textareaRef}
          id={id}
          className={`${inputClass} min-h-24 resize-y leading-relaxed`}
          rows={field.rows ?? 4}
          value={value ?? ""}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "date":
      control = (
        <input
          id={id}
          type="date"
          className={`${inputClass} max-w-60`}
          value={value ?? ""}
          min="1900-01-01"
          max="2100-12-31"
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case "color":
      control = (
        // Fixed grid: every option is exactly the same width and height.
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {field.options.map((opt) => {
            const theme = getTheme(opt);
            const selected = (value ?? field.default) === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={theme.label}
                disabled={disabled}
                onClick={() => onChange(opt)}
                className={`flex h-[5.75rem] w-full flex-col items-center justify-center gap-2 rounded-2xl px-1 text-xs transition ${
                  selected ? "bg-petal ring-2 ring-rose" : "bg-white ring-1 ring-line hover:-translate-y-0.5 hover:ring-ink/30"
                }`}
              >
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-black/10"
                  style={{ background: theme.bg }}
                  aria-hidden
                >
                  <span className="h-4.5 w-4.5 rounded-full" style={{ background: theme.accent }} />
                </span>
                <span className="w-full truncate text-center leading-tight">{theme.label}</span>
              </button>
            );
          })}
        </div>
      );
      break;
    case "font":
      control = (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {field.options.map((opt) => {
            const font: Font = FONTS[opt];
            const selected = (value ?? field.default) === opt;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${font.label} — ${font.hint}`}
                disabled={disabled}
                onClick={() => onChange(opt)}
                className={`flex h-[5.5rem] w-full flex-col justify-between rounded-2xl px-3 py-2.5 text-left transition ${
                  selected ? "bg-petal ring-2 ring-rose" : "bg-white ring-1 ring-line hover:-translate-y-0.5 hover:ring-ink/30"
                }`}
              >
                <span
                  className="block truncate leading-tight text-ink"
                  style={{
                    fontFamily: `var(${font.cssVar})`,
                    fontStyle: font.italic ? "italic" : undefined,
                    fontSize: `${1.25 * (font.scale ?? 1)}rem`,
                  }}
                  aria-hidden
                >
                  {field.previewText ?? "Aa"}
                </span>
                <span className="block text-[11px] leading-tight">
                  <span className="font-medium text-ink">{font.label}</span>
                  <span className="block text-ink-soft">{font.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      );
      break;
    case "music": {
      const tracks = MUSIC_LIBRARY.filter((t) => (field.options as readonly string[]).includes(t.id));
      control = (
        <select
          id={id}
          className={inputClass}
          value={value ?? NO_MUSIC}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value={NO_MUSIC}>No music</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} — {t.mood}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "image":
      control = (
        <ImageFieldControl
          id={id}
          label={field.label}
          state={props.image}
          disabled={disabled}
          required={Boolean(field.required)}
          onSelect={props.onImageSelect}
          onRemove={props.onImageRemove}
        />
      );
      break;
  }

  const counter =
    (field.type === "text" || field.type === "textarea") && (value?.length ?? 0) > field.maxLength * 0.8 ? (
      <span className="text-xs text-ink-soft">
        {value?.length ?? 0}/{field.maxLength}
      </span>
    ) : null;

  return (
    <div data-field={field.id} className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label id={`${id}-label`} htmlFor={field.type === "color" || field.type === "font" ? undefined : id} className="text-sm font-medium text-ink">
          {field.label}
          {field.required ? <span className="text-rose"> *</span> : <span className="font-normal text-ink-soft"> (optional)</span>}
        </label>
        <div className="flex items-center gap-2">
          {counter}
          {field.type === "textarea" && <EmojiPicker onPick={insertEmoji} disabled={disabled} />}
        </div>
      </div>
      {control}
      {field.help && (
        <p id={`${id}-help`} className="text-xs text-ink-soft">
          {field.help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Music fields are hidden while the music library is empty. */
export function isFieldVisible(field: FieldDef): boolean {
  if (field.type !== "music") return true;
  return MUSIC_LIBRARY.some((t) => (field.options as readonly string[]).includes(t.id));
}
