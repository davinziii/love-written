"use client";

import { useRef, type ReactNode } from "react";
import { EmojiPicker } from "./EmojiPicker";
import type { FieldDef } from "@/templates/types";
import { FONTS, getTheme, MUSIC_LIBRARY, NO_MUSIC, type Font } from "@/templates/styles";
import { ImageFieldControl, type ImageState } from "./ImageFieldControl";
import { Dropdown } from "./Dropdown";

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
  /** Shorter label when the context already says what it is (e.g. "Date" under a memory photo). */
  label?: string;
  /** "fill": a textarea stretches to the height of its row. "compact": a smaller input for narrow columns. */
  variant?: "fill" | "compact";
}

const inputClass =
  "w-full rounded-2xl border border-line bg-white px-4 py-3 text-[0.98rem] text-ink placeholder:text-ink-soft/50 focus:border-rose focus:outline-none focus:ring-4 focus:ring-rose/10 disabled:bg-cream";

export function FieldControl(props: FieldControlProps) {
  const { field, value, error, disabled, onChange, variant } = props;
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
          className={`${inputClass} min-h-24 resize-y leading-relaxed ${variant === "fill" ? "flex-1" : ""}`}
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
          className={variant === "compact" ? `${inputClass} !px-3 !py-2.5 !text-sm` : `${inputClass} max-w-60`}
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
        <Dropdown
          labelledBy={`${id}-label`}
          describedBy={describedBy}
          disabled={disabled}
          value={value ?? field.default}
          onChange={onChange}
          columns={2}
          options={field.options.map((opt) => ({ value: opt, label: getTheme(opt).label, render: <ThemeOption id={opt} /> }))}
        />
      );
      break;
    case "font":
      // Every font picker is the same dropdown, each option previewed in its own font.
      control = (
        <Dropdown
          labelledBy={`${id}-label`}
          describedBy={describedBy}
          disabled={disabled}
          value={value ?? field.default}
          onChange={onChange}
          options={field.options.map((opt) => ({
            value: opt,
            label: `${FONTS[opt].label} — ${FONTS[opt].hint}`,
            render: <FontOption font={FONTS[opt]} sample={field.previewText} />,
          }))}
        />
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
    <div data-field={field.id} className={variant === "fill" ? "flex h-full flex-col gap-2" : "space-y-2"}>
      {/* min-h keeps labels on one baseline when fields sit side by side */}
      <div className="flex min-h-7 items-center justify-between gap-3">
        <label id={`${id}-label`} htmlFor={field.type === "color" || field.type === "font" ? undefined : id} className="text-sm font-medium text-ink">
          {props.label ?? field.label}
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

/** A theme as a tiny "page": background, glow, accent dot and a line of text. */
function ThemeOption({ id }: { id: string }) {
  const theme = getTheme(id);
  return (
    <span className="flex items-center gap-3">
      <span className="relative h-9 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10" style={{ background: theme.bg }} aria-hidden>
        <span className="absolute -right-2.5 -top-2.5 h-8 w-8 rounded-full opacity-90" style={{ background: theme.glow }} />
        <span className="absolute bottom-1.5 left-1.5 h-3.5 w-3.5 rounded-full" style={{ background: theme.accent }} />
        <span className="absolute bottom-[0.6rem] left-6 h-1 w-4 rounded-full opacity-60" style={{ background: theme.ink }} />
      </span>
      <span className="truncate text-sm font-medium text-ink">{theme.label}</span>
    </span>
  );
}

/** The sample in the font itself, with its name underneath — left-aligned so every row lines up. */
function FontOption({ font, sample }: { font: Font; sample?: string }) {
  return (
    <span className="block min-w-0 text-left">
      <span
        className="block truncate leading-snug text-ink"
        style={{ fontFamily: `var(${font.cssVar})`, fontStyle: font.italic ? "italic" : undefined, fontSize: `${1.12 * (font.scale ?? 1)}rem` }}
      >
        {sample ?? "Aa"}
      </span>
      <span className="mt-0.5 block text-[11px] leading-tight text-ink-soft">
        <span className="font-medium text-ink">{font.label}</span> · {font.hint}
      </span>
    </span>
  );
}
