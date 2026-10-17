"use client";

import { useRef, useState } from "react";
import { Spinner } from "@/components/ui/Button";
import type { FieldDef } from "@/templates/types";
import { ACCEPTED_IMAGES, type ImageState } from "./ImageFieldControl";

/** Photos prepared and uploaded at the same time — keeps memory low on budget phones. */
const PARALLEL = 2;

/**
 * "Add all your photos at once": pick many photos in one go and they fill the template's
 * empty photo spots in order. Each one then shows in its own spot below, where it can be
 * replaced like any other photo. Uploads run a couple at a time, not all at once.
 */
export function BulkPhotoPicker({
  label,
  help,
  fields,
  images,
  disabled,
  onSelect,
}: {
  label: string;
  help?: string | undefined;
  fields: FieldDef[];
  images: Record<string, ImageState>;
  disabled?: boolean | undefined;
  onSelect: (field: FieldDef, file: File) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  // Only photos that finished uploading count (an uploading one already shows its preview).
  const filled = fields.filter((f) => images[f.id]?.url && !images[f.id]?.uploading).length;
  const busy = progress !== null;

  async function add(files: File[]) {
    const photos = files.filter((f) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name));
    if (!photos.length) {
      setNotice("Those aren't photos. Choose JPG, PNG, WebP or HEIC photos.");
      return;
    }
    const empty = fields.filter((f) => !images[f.id]?.url && !images[f.id]?.uploading);
    if (!empty.length) {
      setNotice(`Every spot already has a photo. Replace any of them below.`);
      return;
    }
    const pairs = photos.slice(0, empty.length).map((file, i) => [empty[i]!, file] as const);
    const skipped = photos.length - pairs.length;
    setNotice(
      skipped > 0
        ? `Only ${empty.length} spot${empty.length === 1 ? " was" : "s were"} empty, so ${skipped} photo${skipped === 1 ? " wasn't" : "s weren't"} added.`
        : null,
    );

    let done = 0;
    setProgress({ done, total: pairs.length });
    const queue = [...pairs];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        // Each upload shows its own error in its spot below; keep going with the rest.
        await Promise.resolve(onSelect(next[0], next[1])).catch(() => undefined);
        setProgress({ done: ++done, total: pairs.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, pairs.length) }, worker));
    setProgress(null);
  }

  return (
    <section
      className={`rounded-[1.75rem] border-2 border-dashed bg-white p-5 transition sm:p-7 ${over ? "border-rose" : "border-line"}`}
      aria-labelledby="bulk-photos-title"
      onDragOver={(e) => {
        if (disabled || busy) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled && !busy) void add([...e.dataTransfer.files]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_IMAGES}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled || busy}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ""; // allow choosing the same photos again
          if (files.length) void add(files);
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 id="bulk-photos-title" className="font-display text-xl">
            {label}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {help ?? "Choose them all in one go — they fill the spots below in order."} {filled} of {fields.length} added.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="lw-press inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-cream disabled:opacity-60"
        >
          {busy ? <Spinner /> : <span aria-hidden>＋</span>}
          {busy ? `Uploading ${progress.done} of ${progress.total}…` : "Choose photos"}
        </button>
      </div>
      {notice && (
        <p role="status" className="mt-3 text-sm text-ink-soft">
          {notice}
        </p>
      )}
    </section>
  );
}
