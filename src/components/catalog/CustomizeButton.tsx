"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Turnstile, turnstileEnabled } from "@/components/ui/Turnstile";
import { api, ClientApiError } from "@/lib/client/api";
import { putLocalDraft } from "@/lib/client/drafts";

interface CreatedDraft {
  surpriseId: string;
  templateId: string;
  editToken: string;
  recoveryCode: string;
}

/** Creates a server draft (once — guarded against double clicks) and opens the studio. */
export function CustomizeButton({ templateId, className = "" }: { templateId: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const draft = await api<CreatedDraft>("/api/surprises", {
        method: "POST",
        body: { templateId, turnstileToken: token ?? undefined },
      });
      putLocalDraft({
        surpriseId: draft.surpriseId,
        templateId: draft.templateId,
        editToken: draft.editToken,
        recoveryCode: draft.recoveryCode,
      });
      router.push(`/studio/${draft.surpriseId}?new=1`);
      // Keep the button busy while navigating.
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <div className={className}>
      <Button onClick={start} busy={busy} busyLabel="Preparing your surprise…" disabled={turnstileEnabled && !token} className="w-full px-8 py-4 text-base">
        Customize this surprise <span aria-hidden>→</span>
      </Button>
      <div className="mt-3">
        <Turnstile onToken={setToken} />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
