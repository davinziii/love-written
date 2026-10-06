"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DevicePreview, type Device } from "@/components/preview/DevicePreview";
import { Button } from "@/components/ui/Button";
import { TemplateExperience } from "@/templates/renderers";
import { buildRenderData } from "@/templates/render-data";
import type { TemplateId } from "@/templates";
import { MIN_SCHEDULE_LEAD_MINUTES } from "@/lib/lifecycle";
import { useHydrated } from "@/lib/client/useHydrated";
import { Icon } from "@/components/ui/icons";
import type { Studio, Reveal } from "./useStudio";

/**
 * Live preview of the customer's current (unsaved) data through the real renderer,
 * switchable between desktop, mobile and full screen.
 */
export function LivePreview({
  studio,
  watermark,
  height = 640,
  defaultDevice = "mobile",
  compact = false,
}: {
  studio: Studio;
  watermark: boolean;
  height?: number;
  defaultDevice?: Device;
  compact?: boolean;
}) {
  if (!studio.template || !studio.state) return null;
  const filled = buildRenderData(studio.template, studio.data, studio.imageUrls);
  // While typing, show each empty required text field's placeholder so the preview never looks broken.
  for (const f of studio.template.fields) {
    if ((f.type === "text" || f.type === "textarea") && f.required && !filled[f.id]?.trim()) {
      filled[f.id] = f.placeholder ?? f.label;
    }
  }
  const templateId = studio.state.templateId as TemplateId;
  return (
    <DevicePreview
      label="Live preview of your surprise"
      watermark={watermark}
      defaultDevice={defaultDevice}
      phoneHeight={height}
      desktopHeight={Math.round(height * 0.78)}
      compact={compact}
      render={() => <TemplateExperience templateId={templateId} data={filled} mode="preview" />}
    />
  );
}

/* ─── Reveal timing ────────────────────────────────────────────────────────── */

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function RevealTiming({
  value,
  onChange,
  error,
  disabled,
}: {
  value: Reveal;
  onChange: (next: Reveal) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const hydrated = useHydrated();
  const tz = hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="font-display text-lg">When should your surprise be revealed?</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["now", "schedule"] as const).map((mode) => {
          const selected = value.mode === mode;
          const Glyph = mode === "now" ? Icon.send : Icon.calendar;
          return (
            <label
              key={mode}
              className={`relative flex cursor-pointer flex-col gap-2 rounded-2xl p-4 ring-1 transition duration-300 has-[:focus-visible]:ring-2 ${
                selected ? "bg-petal ring-2 ring-rose" : "bg-white ring-line hover:-translate-y-0.5 hover:ring-ink/30"
              }`}
            >
              <input
                type="radio"
                name={`${id}-mode`}
                className="sr-only"
                checked={selected}
                onChange={() => onChange({ mode, scheduledFor: mode === "schedule" ? value.scheduledFor : null })}
              />
              <span className={`grid h-9 w-9 place-items-center rounded-full ${selected ? "bg-rose text-white" : "bg-cream text-ink-soft"}`}>
                <Glyph size={17} />
              </span>
              <span className="font-medium">{mode === "now" ? "Publish now" : "Schedule"}</span>
              <span className="text-sm leading-snug text-ink-soft">
                {mode === "now" ? "It goes live the moment you publish." : "Pick a date and time. The link stays closed until then."}
              </span>
              {selected && (
                <span className="lw-pop absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-rose text-white">
                  <Icon.check size={12} strokeWidth={3} />
                </span>
              )}
            </label>
          );
        })}
      </div>
      {value.mode === "schedule" && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <label htmlFor={`${id}-at`} className="text-sm font-medium">
            Reveal date &amp; time
          </label>
          <input
            id={`${id}-at`}
            type="datetime-local"
            className="mt-2 w-full rounded-xl border border-line px-3 py-2.5"
            onFocus={(e) => {
              // the earliest allowed time is a hint only — the server validates it
              e.currentTarget.min = toLocalInput(new Date(Date.now() + MIN_SCHEDULE_LEAD_MINUTES * 60_000).toISOString());
            }}
            value={toLocalInput(value.scheduledFor)}
            onChange={(e) =>
              onChange({ mode: "schedule", scheduledFor: e.target.value ? new Date(e.target.value).toISOString() : null })
            }
          />
          {tz && <p className="mt-2 text-xs text-ink-soft">Your time zone: {tz}</p>}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/* ─── Confirm dialog ───────────────────────────────────────────────────────── */

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Go Back",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-[1.75rem] bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-7">
        <h2 className="font-display text-2xl">{title}</h2>
        <div className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">{children}</div>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} busy={busy} busyLabel="Working on it…">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/* ─── Misc ─────────────────────────────────────────────────────────────────── */

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={url}
        aria-label="Your surprise link"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-3 text-sm"
      />
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // the input is selectable as a fallback
          }
        }}
      >
        {copied ? "Copied ✓" : "Copy link"}
      </Button>
    </div>
  );
}

export function RecoveryCodeCard({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <div className="rounded-[1.5rem] bg-paper p-5 ring-1 ring-line">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose">Your recovery code</p>
      <p className="mt-2 font-mono text-2xl tracking-[0.15em]">{code}</p>
      <p className="mt-2 text-sm text-ink-soft">
        Save this. It lets you find this surprise on another device or if your browser data is cleared — no account
        needed.
      </p>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "danger"; children: ReactNode }) {
  const tones = {
    info: "bg-petal ring-blush",
    success: "bg-[#eaf5ee] ring-[#cfe6d7]",
    warning: "bg-[#fff4e0] ring-[#f6dfb5]",
    danger: "bg-[#fdecea] ring-[#f6cdc9]",
  } as const;
  return <div className={`rounded-2xl px-5 py-4 text-[0.95rem] ring-1 ${tones[tone]}`}>{children}</div>;
}

export function formatReveal(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(iso));
}
