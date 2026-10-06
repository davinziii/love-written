"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Turnstile, turnstileEnabled } from "@/components/ui/Turnstile";
import { api, ClientApiError } from "@/lib/client/api";
import { putLocalDraft } from "@/lib/client/drafts";

export function RecoverForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current || !code.trim()) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ surpriseId: string; templateId: string; editToken: string }>("/api/recover", {
        method: "POST",
        body: { code: code.trim(), turnstileToken: token ?? undefined },
      });
      putLocalDraft({ surpriseId: res.surpriseId, templateId: res.templateId, editToken: res.editToken, recoveryCode: code.trim().toUpperCase(), dirty: false });
      router.push(`/studio/${res.surpriseId}`);
      return;
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
    }
    inFlight.current = false;
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label htmlFor="code" className="block text-sm font-medium">
        Recovery code
      </label>
      <input
        id="code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="XXXX-XXXX-XXXX"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={20}
        className="w-full rounded-2xl border border-line bg-white px-4 py-4 text-center font-mono text-2xl tracking-[0.2em] uppercase focus:border-rose focus:outline-none focus:ring-4 focus:ring-rose/10"
      />
      <Turnstile onToken={setToken} />
      <Button type="submit" busy={busy} busyLabel="Looking…" disabled={!code.trim() || (turnstileEnabled && !token)} className="w-full py-4">
        Find My Surprise
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-center text-xs text-ink-soft">
        Opening your surprise here signs out any other device that was editing it.
      </p>
    </form>
  );
}
