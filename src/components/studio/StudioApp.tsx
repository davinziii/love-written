"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/Brand";
import { Button, Spinner } from "@/components/ui/Button";
import { useStudio, type SaveStatus } from "./useStudio";
import { CustomizeStep, PreviewStep } from "./EditSteps";
import { EndedPanel, FinalizePanel, LivePanel, PaymentPending, PublishFailedPanel, ScheduledPanel } from "./AfterPayment";
import { Notice } from "./parts";
import { UNPUBLISHED_PAID_TTL_DAYS } from "@/lib/lifecycle";

type Step = "customize" | "preview" | "payment";
const SELF_SERVE_STEPS = ["Make it yours", "Preview", "Pay", "Reveal"];
const PAID_FIRST_STEPS = ["Make it yours", "Preview & publish", "Live"];

/**
 * The customer's studio. The server state decides which screen is shown
 * (edit → paid/finalize → scheduled/live …); `?step=` only navigates within editing.
 */
export function StudioApp({ surpriseId }: { surpriseId: string }) {
  const studio = useStudio(surpriseId);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const step = (params.get("step") as Step | null) ?? "customize";
  const [editingAfterPay, setEditingAfterPay] = useState(false);

  const go = useCallback(
    (next: Step) => {
      router.replace(next === "customize" ? pathname : `${pathname}?step=${next}`, { scroll: false });
      window.scrollTo({ top: 0 });
    },
    [router, pathname],
  );

  if (studio.phase === "loading") {
    return (
      <Shell>
        <div className="grid min-h-[50vh] place-items-center text-rose">
          <Spinner className="h-8 w-8" />
        </div>
      </Shell>
    );
  }
  if (studio.phase === "unauthorized" || studio.phase === "not_found") {
    return (
      <Shell>
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="font-display text-3xl">
            {studio.phase === "not_found" ? "We couldn't find that surprise" : "This surprise is protected"}
          </h1>
          <p className="mt-3 text-ink-soft">
            To keep it private, editing only works on the device that created it — or with your recovery code.
          </p>
          <Link href="/recover" className="mt-8 inline-flex rounded-full bg-rose px-6 py-3 font-medium text-white hover:bg-rose-deep">
            Use my recovery code
          </Link>
        </div>
      </Shell>
    );
  }
  if (studio.phase === "error" || !studio.state || !studio.template) {
    return (
      <Shell>
        <div className="mx-auto max-w-md py-16 text-center">
          <h1 className="font-display text-3xl">We couldn&rsquo;t load your surprise</h1>
          <p className="mt-3 text-ink-soft">Your work has not been lost. Check your connection and try again.</p>
          <Button className="mt-8" onClick={() => void studio.reload()}>
            Try again
          </Button>
        </div>
      </Shell>
    );
  }

  const { state } = studio;
  // Manual workflow: the order is paid before customizing, so there is no "Pay" step.
  const paidFirst = state.paymentStatus === "PAID" && state.order?.paymentMethod !== "paymongo";
  const labels = paidFirst ? PAID_FIRST_STEPS : SELF_SERVE_STEPS;
  let body: React.ReactNode;
  let activeStep = 0;
  const publishStep = paidFirst ? 1 : 3;

  switch (state.screen) {
    case "edit":
      if (step === "payment" && state.paymentStatus !== "PAID") {
        activeStep = 2;
        body = <PaymentPending studio={studio} onBackToPreview={() => go("preview")} />;
      } else if (step === "preview" && state.paymentStatus === "PAID") {
        activeStep = 1;
        body = <FinalizePanel studio={studio} onEdit={() => go("customize")} />;
      } else if (step === "preview") {
        activeStep = 1;
        body = <PreviewStep studio={studio} onBack={() => go("customize")} cancelled={params.get("payment") === "cancelled"} />;
      } else {
        body = (
          <CustomizeStep
            studio={studio}
            watermark={state.paymentStatus !== "PAID"}
            continueLabel={state.paymentStatus === "PAID" ? "Preview & publish" : "Preview your surprise"}
            onContinue={() => go("preview")}
            intro={<WelcomeNotice paidFirst={paidFirst} isNew={params.get("new") === "1" || state.stage === "DRAFT"} />}
          />
        );
      }
      break;
    case "finalize":
      activeStep = publishStep;
      body = editingAfterPay ? (
        <CustomizeStep
          studio={studio}
          watermark={false}
          continueLabel="Done editing"
          onContinue={() => setEditingAfterPay(false)}
          onBack={() => setEditingAfterPay(false)}
          backLabel="Go back"
        />
      ) : (
        <FinalizePanel studio={studio} onEdit={() => setEditingAfterPay(true)} />
      );
      break;
    case "publish_failed":
      activeStep = publishStep;
      body = <PublishFailedPanel studio={studio} />;
      break;
    case "scheduled":
      activeStep = paidFirst ? 2 : 3;
      body = editingAfterPay ? (
        <CustomizeStep
          studio={studio}
          watermark={false}
          continueLabel="Done editing"
          onContinue={() => setEditingAfterPay(false)}
          onBack={() => setEditingAfterPay(false)}
          backLabel="Go back to your scheduled surprise"
          intro={<Notice>Your surprise is scheduled. Changes save automatically and every required field must stay filled in.</Notice>}
        />
      ) : (
        <ScheduledPanel studio={studio} onEdit={() => setEditingAfterPay(true)} />
      );
      break;
    case "live":
      activeStep = labels.length;
      body = <LivePanel studio={studio} />;
      break;
    case "ended":
      activeStep = labels.length;
      body = <EndedPanel studio={studio} />;
      break;
  }

  return (
    <Shell saveStatus={studio.saveStatus} activeStep={activeStep} labels={labels} templateName={studio.template.name}>
      {body}
    </Shell>
  );
}

function WelcomeNotice({ paidFirst, isNew }: { paidFirst: boolean; isNew: boolean }) {
  if (!isNew) return null;
  return (
    <Notice>
      <p className="font-display text-lg">{paidFirst ? "Your order is confirmed — let’s make it yours ❤️" : "Let’s make it yours ❤️"}</p>
      <p className="text-sm text-ink-soft">
        Everything saves automatically. Your recovery code is below — keep it to come back on any device.
      </p>
      {paidFirst && (
        <p className="mt-1 text-xs text-ink-soft">
          Take your time — just don&rsquo;t leave it unopened for {UNPUBLISHED_PAID_TTL_DAYS} days before publishing, or
          it&rsquo;s deleted.
        </p>
      )}
    </Notice>
  );
}

function Shell({
  children,
  saveStatus,
  activeStep,
  labels = SELF_SERVE_STEPS,
  templateName,
}: {
  children: React.ReactNode;
  saveStatus?: SaveStatus;
  activeStep?: number;
  labels?: string[];
  templateName?: string;
}) {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo className="text-lg" />
            {templateName && <span className="hidden text-sm text-ink-soft sm:inline">· {templateName}</span>}
          </div>
          {activeStep !== undefined && (
            <ol className="hidden items-center gap-2 text-sm md:flex" aria-label="Progress">
              {labels.map((label, i) => (
                <li key={label} className="flex items-center gap-2">
                  <span
                    aria-current={i === activeStep ? "step" : undefined}
                    className={`rounded-full px-3 py-1 ${i === activeStep ? "bg-ink text-cream" : i < activeStep ? "text-ink" : "text-ink-soft/70"}`}
                  >
                    {i < activeStep ? "✓ " : ""}
                    {label}
                  </span>
                  {i < labels.length - 1 && <span className="text-line" aria-hidden>—</span>}
                </li>
              ))}
            </ol>
          )}
          <SaveIndicator status={saveStatus} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function SaveIndicator({ status }: { status?: SaveStatus }) {
  if (!status || status === "idle") return <span className="w-24" />;
  const text = {
    saving: "Saving…",
    saved: "All changes saved",
    retrying: "Offline — saved on this device, retrying…",
    invalid: "Check highlighted fields",
  }[status];
  return (
    <span role="status" aria-live="polite" className={`max-w-48 text-right text-xs ${status === "retrying" || status === "invalid" ? "text-danger" : "text-ink-soft"}`}>
      {text}
    </span>
  );
}
