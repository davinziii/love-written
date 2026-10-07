"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Turnstile, turnstileEnabled } from "@/components/ui/Turnstile";
import { api, ClientApiError, newIdempotencyKey } from "@/lib/client/api";
import { CONTENT_REPORT_REASONS, type ContentReportReason } from "@/lib/report-reasons";

/**
 * Quiet "Report a concern" link under a published surprise. Lets a recipient flag abuse
 * (see the Terms page); the owner gets an email and can take the surprise down.
 */
export function ReportSurprise({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ContentReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    key.current ??= newIdempotencyKey();
    try {
      const res = await api<{ reportCode: string }>("/api/reports/content", {
        method: "POST",
        body: { token, reason, details: details || undefined, idempotencyKey: key.current, turnstileToken: captcha ?? undefined },
      });
      setCode(res.reportCode);
    } catch (err) {
      if (err instanceof ClientApiError && err.status !== 0) key.current = null;
      setError(err instanceof ClientApiError ? err.message : "Couldn't send the report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-6 text-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-[var(--lw-muted)] opacity-70 underline decoration-dotted underline-offset-4 hover:opacity-100"
      >
        Report a concern
      </button>

      <dialog
        ref={dialog}
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) setOpen(false);
        }}
        className="m-auto w-[min(92vw,28rem)] rounded-[1.75rem] bg-paper p-0 text-left text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-sm"
      >
        {code ? (
          <div className="p-7 text-center">
            <h2 className="font-display text-2xl">Thank you</h2>
            <p className="mt-3 text-sm text-ink-soft">
              We&rsquo;ll review this surprise and take it down if it breaks our rules. Your report is anonymous.
            </p>
            <p className="mt-4 inline-block rounded-full bg-cream px-4 py-1.5 font-mono text-xs">{code}</p>
            <div className="mt-6">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-7">
            <h2 className="font-display text-2xl">Report this surprise</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Tell us what&rsquo;s wrong. Reports are anonymous. See our{" "}
              <Link href="/terms#acceptable-use" target="_blank" className="text-rose underline underline-offset-2">
                rules
              </Link>
              .
            </p>
            <fieldset className="mt-5 space-y-2">
              <legend className="sr-only">Reason</legend>
              {(Object.entries(CONTENT_REPORT_REASONS) as [ContentReportReason, string][]).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-2.5 text-sm ring-1 ring-line has-[:checked]:bg-petal has-[:checked]:ring-rose"
                >
                  <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-[var(--color-rose)]" />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="mt-4 block text-sm">
              <span className="font-medium">More details</span> <span className="text-ink-soft">(optional)</span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-3"
              />
            </label>
            <div className="mt-3">
              <Turnstile onToken={setCaptcha} />
            </div>
            {error && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" busy={busy} disabled={!reason || (turnstileEnabled && !captcha)}>
                Send report
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
