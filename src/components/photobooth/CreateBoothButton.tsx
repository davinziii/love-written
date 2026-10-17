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
export function CreateBoothButton({ label, soloLabel }: { label: string; soloLabel: string }) {
  const [partySize, setPartySize] = useState<1 | 2>(2);
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
        key = sessionStorage.getItem(`${PENDING_KEY}:${partySize}`) ?? newIdempotencyKey();
        sessionStorage.setItem(`${PENDING_KEY}:${partySize}`, key);
      } catch {
        key = newIdempotencyKey();
      }
      const res = await api<{ sessionId: string; token: string; checkoutUrl: string | null }>("/api/photobooth", {
        method: "POST",
        body: { createKey: key, partySize, turnstileToken: captcha ?? undefined },
        retries: 1,
      });
      // Remember Person A's private link on this device before leaving for checkout.
      rememberBoothToken(res.sessionId, res.token);
      try {
        sessionStorage.removeItem(`${PENDING_KEY}:${partySize}`);
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
      <div className="mb-3 inline-flex rounded-full bg-white p-1 ring-1 ring-line" role="radiogroup" aria-label="Who's in the photobooth">
        {(
          [
            [2, "With my person"],
            [1, "Just me"],
          ] as const
        ).map(([size, text]) => (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={partySize === size}
            disabled={busy}
            onClick={() => setPartySize(size)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${partySize === size ? "bg-ink text-cream" : "text-ink-soft hover:text-ink"}`}
          >
            {text}
          </button>
        ))}
      </div>
      <Button onClick={create} busy={busy} busyLabel="Opening payment…" disabled={turnstileEnabled && !captcha} className="block w-full px-8 py-4 text-base sm:w-auto">
        {partySize === 1 ? soloLabel : label}
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
