"use client";

import { useEffect, useRef, useState } from "react";
import { GenericEditor } from "@/components/editor/GenericEditor";
import { Button } from "@/components/ui/Button";
import { missingRequiredFields } from "@/templates/schema";
import { formatPeso } from "@/lib/format";
import { validateScheduleTime } from "@/lib/lifecycle";
import { api, ClientApiError, newIdempotencyKey } from "@/lib/client/api";
import { trackClient } from "@/lib/client/analytics";
import { LivePreview, Notice, RecoveryCodeCard, RevealTiming } from "./parts";
import type { Studio } from "./useStudio";

/* ─── Step 1: Make it yours ────────────────────────────────────────────────── */

export function CustomizeStep({
  studio,
  watermark,
  onContinue,
  continueLabel = "Preview your surprise",
  intro,
}: {
  studio: Studio;
  watermark: boolean;
  onContinue: () => void;
  continueLabel?: string;
  intro?: React.ReactNode;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const template = studio.template!;

  function attemptContinue() {
    const gaps = missingRequiredFields(template, studio.data, studio.imageFieldsPresent);
    if (gaps.length > 0) {
      setMissing(gaps.map((f) => f.label));
      studio.setErrors(Object.fromEntries(gaps.map((f) => [f.id, f.type === "image" ? "Please add a photo" : "This is required"])));
      document.querySelector(`[data-field="${gaps[0]!.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setMissing([]);
    onContinue();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6 pb-28 lg:pb-10">
        {intro}
        <GenericEditor
          template={template}
          data={studio.data}
          images={studio.images}
          errors={studio.errors}
          onFieldChange={studio.setField}
          onImageSelect={(f, file) => void studio.uploadImage(f, file)}
          onImageRemove={(f) => void studio.removeImage(f)}
        />
        {missing.length > 0 && (
          <Notice tone="warning">
            <p className="font-medium">A few things still need your attention:</p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Notice>
        )}
        <div className="hidden justify-end lg:flex">
          <Button onClick={attemptContinue} disabled={studio.uploading} className="px-7">
            {continueLabel} <span aria-hidden>→</span>
          </Button>
        </div>
        <div className="lg:hidden">
          <RecoveryCodeCard code={studio.recoveryCode} />
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-5">
          <LivePreview studio={studio} watermark={watermark} height={600} compact />
          <RecoveryCodeCard code={studio.recoveryCode} />
        </div>
      </aside>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-3 border-t border-line bg-cream/95 p-3 backdrop-blur lg:hidden">
        <Button variant="secondary" className="flex-1" onClick={() => setShowPreview(true)}>
          Preview
        </Button>
        <Button className="flex-[1.4]" onClick={attemptContinue} disabled={studio.uploading}>
          {continueLabel}
        </Button>
      </div>

      {showPreview && (
        <div role="dialog" aria-modal="true" aria-label="Preview" className="fixed inset-0 z-40 overflow-y-auto bg-ink/80 p-4 backdrop-blur lg:hidden">
          <div className="mx-auto max-w-[400px]">
            <div className="mb-3 flex justify-end">
              <Button variant="secondary" onClick={() => setShowPreview(false)}>
                Close preview
              </Button>
            </div>
            <LivePreview studio={studio} watermark={watermark} height={Math.min(680, typeof window === "undefined" ? 640 : window.innerHeight - 120)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Step 2: Preview, reveal timing, checkout ─────────────────────────────── */

export function PreviewStep({ studio, onBack, cancelled }: { studio: Studio; onBack: () => void; cancelled: boolean }) {
  const state = studio.state!;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timingError, setTimingError] = useState<string | undefined>();
  const key = useRef<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => trackClient("customization_completed", state.templateId), [state.templateId]);

  async function checkout() {
    if (inFlight.current) return;
    if (studio.reveal.mode === "schedule") {
      const check = validateScheduleTime(new Date(studio.reveal.scheduledFor ?? NaN));
      if (!check.ok) {
        setTimingError(check.message);
        return;
      }
    }
    setTimingError(undefined);
    inFlight.current = true;
    setBusy(true);
    setError(null);
    trackClient("checkout_clicked", state.templateId);
    key.current ??= newIdempotencyKey();
    try {
      if (!(await studio.flush())) throw new ClientApiError(0, "SAVE", "We couldn't save your latest changes. Please try again.");
      const res = await api<{ kind: "redirect"; checkoutUrl: string } | { kind: "already_paid" }>(
        `/api/surprises/${state.id}/checkout`,
        { method: "POST", editToken: studio.editToken() ?? undefined, body: { idempotencyKey: key.current } },
      );
      if (res.kind === "redirect") {
        window.location.assign(res.checkoutUrl);
        return; // stay busy while the browser leaves
      }
      await studio.refresh();
    } catch (err) {
      if (err instanceof ClientApiError) {
        if (err.status !== 0) key.current = null;
        if (err.fields?.scheduledFor) setTimingError(err.fields.scheduledFor);
        else if (err.fields) {
          studio.setErrors(err.fields);
          onBack();
        }
        setError(err.message);
      } else setError("Something went wrong. You have not been charged. Please try again.");
    }
    inFlight.current = false;
    setBusy(false);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section aria-label="Watermarked preview" className="rounded-[2.5rem] bg-[radial-gradient(60%_50%_at_50%_30%,#f6d5dc,transparent_75%)] py-6">
        <LivePreview studio={studio} watermark height={700} defaultDevice="desktop" />
        <p className="mt-4 text-center text-sm text-ink-soft">This is exactly what they&rsquo;ll see — minus the watermark.</p>
      </section>

      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        {cancelled && <Notice tone="warning">Payment wasn&rsquo;t completed, so you haven&rsquo;t been charged. You can try again whenever you&rsquo;re ready.</Notice>}
        {state.paymentStatus === "PAYMENT_FAILED" && !cancelled && (
          <Notice tone="warning">Your last payment attempt didn&rsquo;t go through. Please try again or use another payment method.</Notice>
        )}
        <div className="rounded-[1.75rem] bg-paper p-6 ring-1 ring-line">
          <RevealTiming value={studio.reveal} onChange={(r) => { setTimingError(undefined); studio.setReveal(r); }} error={timingError} disabled={busy} />
        </div>
        <div className="rounded-[1.75rem] bg-paper p-6 ring-1 ring-line">
          <div className="flex items-baseline justify-between">
            <span className="text-ink-soft">Total</span>
            <span className="font-display text-3xl">{formatPeso(state.priceCentavos)}</span>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            GCash, Maya, QR Ph or card via PayMongo. You&rsquo;ll confirm publishing after payment — you can still edit until then.
          </p>
          <Button onClick={checkout} busy={busy} busyLabel="Opening secure payment…" className="mt-5 w-full py-4">
            Continue to payment
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-ink-soft">
            Successful payments are non-refundable. If anything goes wrong while publishing after you pay, you will never
            be asked to pay again.
          </p>
        </div>
        <Button variant="ghost" onClick={onBack} disabled={busy} className="w-full">
          ← Back to editing
        </Button>
      </aside>
    </div>
  );
}
