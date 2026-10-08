"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Turnstile, turnstileEnabled } from "@/components/ui/Turnstile";
import { api, ClientApiError, newIdempotencyKey } from "@/lib/client/api";
import { rememberBoothToken } from "@/lib/photobooth/client";

const PENDING_KEY = "lw:booth-create";

/**
 * Self-serve: create the photobooth and go to PayMongo. The same key is reused until the
 * page is left, so a double click or a retry can never create two photobooths or charges.
 */
export function CreateBoothButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function create() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      let key: string;
      try {
        key = sessionStorage.getItem(PENDING_KEY) ?? newIdempotencyKey();
        sessionStorage.setItem(PENDING_KEY, key);
      } catch {
        key = newIdempotencyKey();
      }
      const res = await api<{ sessionId: string; token: string; checkoutUrl: string | null }>("/api/photobooth", {
        method: "POST",
        body: { createKey: key, turnstileToken: captcha ?? undefined },
        retries: 1,
      });
      // Remember Person A's private link on this device before leaving for checkout.
      rememberBoothToken(res.sessionId, res.token);
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        // ignore
      }
      window.location.assign(res.checkoutUrl ?? `/photobooth/s/${res.sessionId}#k=${res.token}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. You have not been charged — please try again.");
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <div>
      <Button onClick={create} busy={busy} busyLabel="Opening payment…" disabled={turnstileEnabled && !captcha} className="w-full px-8 py-4 text-base sm:w-auto">
        {label}
      </Button>
      <div className="mt-3">
        <Turnstile onToken={setCaptcha} />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
