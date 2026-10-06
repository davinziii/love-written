"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@/components/ui/Button";
import { api, ClientApiError, newIdempotencyKey } from "@/lib/client/api";
import { HOSTING_DAYS, validateScheduleTime } from "@/lib/lifecycle";
import { CopyLink, ConfirmDialog, formatReveal, LivePreview, Notice, RecoveryCodeCard, RevealTiming } from "./parts";
import { usePublish } from "./usePublish";
import { Celebrate } from "@/components/motion/Motion";
import { HeartQrCard } from "./HeartQrCard";
import type { Reveal, Studio } from "./useStudio";

/* ─── Waiting for the PayMongo webhook ─────────────────────────────────────── */

const POLL_MS = 2500;
const POLL_FOR_MS = 3 * 60_000;

/**
 * Shown after returning from PayMongo. We never trust the redirect itself: this only
 * polls our server until the verified webhook has marked the order PAID.
 */
export function PaymentPending({ studio, onBackToPreview }: { studio: Studio; onBackToPreview: () => void }) {
  const [timedOut, setTimedOut] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    async function tick() {
      if (stopped) return;
      try {
        const s = await api<{ paymentStatus: string }>(`/api/surprises/${studio.state!.id}/status`, {
          editToken: studio.editToken() ?? undefined,
        });
        if (s.paymentStatus === "PAID") {
          await studio.refresh();
          return;
        }
      } catch {
        // keep polling through hiccups
      }
      if (Date.now() - started > POLL_FOR_MS) setTimedOut(true);
      else setTimeout(tick, POLL_MS);
    }
    void tick();
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      {!timedOut ? (
        <>
          <Spinner className="h-8 w-8 text-rose" />
          <h1 className="mt-6 font-display text-3xl">Confirming your payment…</h1>
          <p className="mt-3 text-ink-soft">
            We&rsquo;re waiting for PayMongo to confirm it. This usually takes a few seconds. Please don&rsquo;t pay again.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl">Still waiting for confirmation</h1>
          <p className="mt-3 text-ink-soft">
            If you completed the payment, it will appear here as soon as PayMongo confirms it — please don&rsquo;t pay
            again. If you cancelled, you can go back and try again.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => {
                setTimedOut(false);
                setRound((r) => r + 1);
              }}
            >
              Check again
            </Button>
            <Button variant="secondary" onClick={onBackToPreview}>
              Back to preview
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Paid: confirm publish now / schedule ─────────────────────────────────── */

export function FinalizePanel({ studio, onEdit }: { studio: Studio; onEdit: () => void }) {
  const state = studio.state!;
  const { publish, busy, error, fieldErrors } = usePublish(studio);
  const [confirming, setConfirming] = useState(false);
  const [timingError, setTimingError] = useState<string>();
  const reveal = studio.reveal;

  function openConfirm() {
    if (reveal.mode === "schedule") {
      const check = validateScheduleTime(new Date(reveal.scheduledFor ?? NaN));
      if (!check.ok) return setTimingError(check.message);
    }
    setTimingError(undefined);
    setConfirming(true);
  }

  async function confirm() {
    const ok = await publish(reveal.mode, reveal.scheduledFor);
    if (ok) setConfirming(false);
    else setConfirming(false);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section aria-label="Final preview" className="order-2 lg:order-1">
        <LivePreview studio={studio} watermark={false} height={700} defaultDevice="desktop" />
      </section>
      <aside className="order-1 space-y-5 lg:order-2 lg:sticky lg:top-24 lg:self-start">
        <Notice tone="success">
          <p className="font-medium">{state.order?.paymentMethod === "manual" ? "Order confirmed ✅" : "Payment received ✅"}</p>
          {state.order && <p className="text-sm text-ink-soft">Order {state.order.orderNumber} · nothing more to pay</p>}
        </Notice>
        <div className="rounded-[1.75rem] bg-paper p-6 ring-1 ring-line">
          <RevealTiming value={reveal} onChange={(r) => { setTimingError(undefined); studio.setReveal(r); }} error={timingError ?? fieldErrors.scheduledFor} disabled={busy} />
        </div>
        <Button onClick={openConfirm} disabled={busy || studio.uploading} className="w-full py-4">
          {reveal.mode === "schedule" ? "Schedule My Surprise" : "Publish My Surprise"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button variant="ghost" className="w-full" onClick={onEdit} disabled={busy}>
          ← Keep editing
        </Button>
        <RecoveryCodeCard code={studio.recoveryCode} />
      </aside>

      <ConfirmDialog
        open={confirming}
        title={reveal.mode === "schedule" ? "Ready to schedule?" : "Ready to publish?"}
        confirmLabel={reveal.mode === "schedule" ? "Schedule My Surprise" : "Publish My Surprise"}
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
      >
        {reveal.mode === "schedule" && (
          <p className="mb-3 rounded-2xl bg-petal p-3 text-ink">
            Your surprise will be revealed on <strong>{formatReveal(reveal.scheduledFor)}</strong>. You&rsquo;ll get the
            link now and can keep editing until then.
          </p>
        )}
        <p>Once your surprise goes live:</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>You won&rsquo;t be able to edit it</li>
          <li>Your photos and content will be locked</li>
          <li>The surprise will be available to the recipient</li>
          <li>It will remain online for {HOSTING_DAYS} days</li>
          <li>After expiration, the surprise data will be deleted</li>
        </ul>
      </ConfirmDialog>
    </div>
  );
}

/* ─── Paid but publishing failed ───────────────────────────────────────────── */

export function PublishFailedPanel({ studio }: { studio: Studio }) {
  const state = studio.state!;
  const { publish, busy, error } = usePublish(studio);
  const [reporting, setReporting] = useState(false);
  const [message, setMessage] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportCode, setReportCode] = useState<string | null>(state.report?.code ?? null);
  const reportKey = useRef<string | null>(null);

  function retry() {
    const future = state.revealMode === "schedule" && state.scheduledFor && validateScheduleTime(new Date(state.scheduledFor)).ok;
    void publish(future ? "schedule" : "now", future ? state.scheduledFor : null);
  }

  async function submitReport() {
    setReportBusy(true);
    setReportError(null);
    reportKey.current ??= newIdempotencyKey();
    try {
      const res = await api<{ reportCode: string }>(`/api/surprises/${state.id}/reports`, {
        method: "POST",
        editToken: studio.editToken() ?? undefined,
        body: { idempotencyKey: reportKey.current, message: message || undefined },
      });
      setReportCode(res.reportCode);
      setReporting(false);
    } catch (err) {
      if (err instanceof ClientApiError && err.status !== 0) reportKey.current = null;
      setReportError(err instanceof ClientApiError ? err.message : "We couldn't send the report. Please try again.");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="rounded-[2rem] bg-paper p-7 ring-1 ring-line sm:p-9">
        <h1 className="font-display text-3xl">Something went wrong</h1>
        <p className="mt-3 text-ink-soft">We received your payment, but your surprise couldn&rsquo;t be published yet.</p>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-[#eaf5ee] p-4">
            <p className="text-ink-soft">Payment</p>
            <p className="mt-1 font-medium">PAID ✅</p>
          </div>
          <div className="rounded-2xl bg-[#fdecea] p-4">
            <p className="text-ink-soft">Publishing</p>
            <p className="mt-1 font-medium">FAILED ❌</p>
          </div>
        </div>
        <p className="mt-5 font-medium">Do not pay again.</p>
        <p className="mt-1 text-ink-soft">
          We&rsquo;ve recorded your payment{state.order ? ` (order ${state.order.orderNumber})` : ""} and the publishing
          problem. You can try again now, or report it and we&rsquo;ll fix it for you.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button onClick={retry} busy={busy} busyLabel="Trying again…" className="flex-1">
            Try Again
          </Button>
          {!reportCode && (
            <Button variant="secondary" className="flex-1" onClick={() => setReporting(true)} disabled={busy}>
              Report This Problem
            </Button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}

        {reporting && !reportCode && (
          <div className="mt-6 space-y-3 rounded-2xl bg-cream p-5 ring-1 ring-line">
            <label htmlFor="report-msg" className="text-sm font-medium">
              Anything you&rsquo;d like us to know? <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <textarea
              id="report-msg"
              maxLength={1000}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-2xl border border-line bg-white px-4 py-3"
            />
            <Button onClick={submitReport} busy={reportBusy} busyLabel="Sending…" className="w-full">
              Send report
            </Button>
            {reportError && (
              <p role="alert" className="text-sm text-danger">
                {reportError}
              </p>
            )}
          </div>
        )}

        {reportCode && (
          <div className="mt-6 rounded-2xl bg-petal p-5 text-center">
            <p className="text-sm text-ink-soft">Report ID</p>
            <p className="mt-1 font-mono text-2xl tracking-wider">{reportCode}</p>
            <p className="mt-2 text-sm text-ink-soft">
              Keep this code. It links directly to your payment and the failed publish, so we can fix it without asking
              you to pay again.
            </p>
          </div>
        )}
      </div>
      <div className="mt-5">
        <RecoveryCodeCard code={studio.recoveryCode} />
      </div>
    </div>
  );
}

/* ─── Scheduled ────────────────────────────────────────────────────────────── */

export function ScheduledPanel({ studio, onEdit }: { studio: Studio; onEdit: () => void }) {
  const state = studio.state!;
  const celebrate = useCelebrateOnce(`scheduled:${state.id}:${state.scheduledFor}`);
  const { publish, busy, error, fieldErrors } = usePublish(studio);
  const [changing, setChanging] = useState(false);
  const [newReveal, setNewReveal] = useState<Reveal>({ mode: "schedule", scheduledFor: state.scheduledFor });
  const [confirmNow, setConfirmNow] = useState(false);
  const [timingError, setTimingError] = useState<string>();

  async function reschedule() {
    const check = validateScheduleTime(new Date(newReveal.scheduledFor ?? NaN));
    if (newReveal.mode === "schedule" && !check.ok) return setTimingError(check.message);
    if (newReveal.mode === "now") return setConfirmNow(true);
    if (await publish("schedule", newReveal.scheduledFor)) setChanging(false);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
      {celebrate && <Celebrate />}
      <section className="space-y-6">
        <div className="rounded-[2rem] bg-paper p-7 ring-1 ring-line sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose">Scheduled 💌</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Your surprise is ready and waiting</h1>
          <p className="mt-3 text-ink-soft">
            It will be revealed on <strong className="text-ink">{formatReveal(state.scheduledFor)}</strong>. You can share
            the link any time — it won&rsquo;t open before then.
          </p>
          {state.publicUrl && <div className="mt-6"><CopyLink url={state.publicUrl} /></div>}
          <p className="mt-6 text-sm text-ink-soft">
            You can keep editing until the reveal. After it goes live, it&rsquo;s locked and stays online for {HOSTING_DAYS}{" "}
            days.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onEdit}>Edit content</Button>
            <Button variant="secondary" onClick={() => setChanging((c) => !c)}>Change reveal time</Button>
          </div>
          {changing && (
            <div className="mt-6 space-y-4 rounded-2xl bg-cream p-5 ring-1 ring-line">
              <RevealTiming value={newReveal} onChange={(r) => { setTimingError(undefined); setNewReveal(r); }} error={timingError ?? fieldErrors.scheduledFor} disabled={busy} />
              <Button onClick={reschedule} busy={busy} className="w-full">
                {newReveal.mode === "now" ? "Reveal now instead" : "Save new reveal time"}
              </Button>
            </div>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </div>
        {state.publicUrl && <HeartQrCard url={state.publicUrl} />}
        <RecoveryCodeCard code={studio.recoveryCode} />
      </section>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <LivePreview studio={studio} watermark={false} />
      </aside>

      <ConfirmDialog
        open={confirmNow}
        title="Reveal it now?"
        confirmLabel="Publish My Surprise"
        busy={busy}
        onCancel={() => setConfirmNow(false)}
        onConfirm={async () => {
          await publish("now", null);
          setConfirmNow(false);
        }}
      >
        <p>Once your surprise goes live:</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>You won&rsquo;t be able to edit it</li>
          <li>Your photos and content will be locked</li>
          <li>The surprise will be available to the recipient</li>
          <li>It will remain online for {HOSTING_DAYS} days</li>
          <li>After expiration, the surprise data will be deleted</li>
        </ul>
      </ConfirmDialog>
    </div>
  );
}

/* ─── Live / ended ─────────────────────────────────────────────────────────── */

export function LivePanel({ studio }: { studio: Studio }) {
  const state = studio.state!;
  const celebrate = useCelebrateOnce(`live:${state.id}`);
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
      {celebrate && <Celebrate />}
      <section className="space-y-6">
        <div className="rounded-[2rem] bg-paper p-7 ring-1 ring-line sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-rose">It&rsquo;s live 🎉</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Your surprise is ready to be opened</h1>
          <p className="mt-3 text-ink-soft">Send them this link. Anyone with the link can open it, so share it only with them.</p>
          {state.publicUrl && (
            <div className="mt-6 space-y-3">
              <CopyLink url={state.publicUrl} />
              <a href={state.publicUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-rose underline underline-offset-4">
                Open it yourself ↗
              </a>
            </div>
          )}
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-cream p-4">
              <dt className="text-ink-soft">Went live</dt>
              <dd className="mt-1 font-medium">{formatReveal(state.publishedAt)}</dd>
            </div>
            <div className="rounded-2xl bg-cream p-4">
              <dt className="text-ink-soft">Online until</dt>
              <dd className="mt-1 font-medium">{formatReveal(state.expiresAt)}</dd>
            </div>
          </dl>
          <div className="mt-6">
            <Notice tone="info">
              <span className="text-sm">
                Your surprise is now locked and can&rsquo;t be edited. After {HOSTING_DAYS} days its photos and messages are
                deleted — save anything you&rsquo;d like to keep.
              </span>
            </Notice>
          </div>
        </div>
        {state.publicUrl && <HeartQrCard url={state.publicUrl} />}
        <RecoveryCodeCard code={studio.recoveryCode} />
      </section>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <LivePreview studio={studio} watermark={false} />
      </aside>
    </div>
  );
}

export function EndedPanel({ studio }: { studio: Studio }) {
  const disabled = studio.state?.stage === "DISABLED";
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="font-display text-3xl">{disabled ? "This surprise is unavailable" : "This surprise has ended"}</h1>
      <p className="mt-3 text-ink-soft">
        {disabled
          ? "It has been taken offline. If you think this is a mistake, contact us with your recovery code."
          : `Surprises stay online for ${HOSTING_DAYS} days after they go live. Its photos and messages have been (or are being) deleted.`}
      </p>
      <Link href="/surprises" className="mt-8 inline-flex rounded-full bg-rose px-6 py-3 font-medium text-white hover:bg-rose-deep">
        Make a new surprise
      </Link>
    </div>
  );
}

/** True the first time this browser tab shows a given milestone (publish / schedule). */
function useCelebrateOnce(key: string): boolean {
  const [show] = useState(() => {
    try {
      const k = `lw:celebrated:${key}`;
      if (sessionStorage.getItem(k)) return false;
      sessionStorage.setItem(k, "1");
      return true;
    } catch {
      return false;
    }
  });
  return show;
}
