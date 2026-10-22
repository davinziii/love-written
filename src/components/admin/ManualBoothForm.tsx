"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MANUAL_PAYMENT_CHANNELS, PAYMENT_CHANNEL_LABELS, PAYMENT_REFERENCE_HINT, type ManualPaymentChannel } from "@/lib/payments/channels";
import { createManualBoothAction, type BoothIssueResult } from "@/app/admin/(dash)/photobooth/actions";
import { BoothLinksCard } from "./BoothLinksCard";

const field = "w-full rounded-2xl bg-soft px-4 py-3 text-sm outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-rose/40";

/** Record a manual photobooth payment and issue the private links. */
export function ManualBoothForm({ defaultAmountPesos, idempotencyKey }: { defaultAmountPesos: number; idempotencyKey: string }) {
  const [state, action, pending] = useActionState<BoothIssueResult | null, FormData>(createManualBoothAction, null);
  const [paid, setPaid] = useState(false);
  const [channel, setChannel] = useState<ManualPaymentChannel>("gcash");

  if (state?.ok && state.booth) {
    return (
      <div className="space-y-5">
        {state.booth.linkA ? (
          <BoothLinksCard linkA={state.booth.linkA} linkB={state.booth.linkB} orderNumber={state.booth.orderNumber} fresh />
        ) : (
          <p className="text-sm">This photobooth was already created — find its links on its page.</p>
        )}
        <a href={`/admin/photobooth/${state.booth.sessionId}`} className="inline-flex text-sm text-rose underline underline-offset-4">
          Open this photobooth
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Who&rsquo;s in the photobooth</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: "2", label: "Two people", hint: "Their own link + an invite link for their person" },
            { value: "1", label: "Just one person", hint: "One link · no invite, no chat · one photo per moment" },
          ].map((o) => (
            <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-soft px-4 py-3 text-sm ring-1 ring-transparent has-[:checked]:bg-white has-[:checked]:ring-rose/40">
              <input type="radio" name="partySize" value={o.value} defaultChecked={o.value === "2"} className="mt-0.5 accent-rose" />
              <span>
                <span className="block font-medium">{o.label}</span>
                <span className="block text-xs text-ink-soft">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2 text-sm font-medium">
          Amount received (₱)
          <input name="amountPesos" type="number" min="1" step="0.01" required defaultValue={defaultAmountPesos} className={field} />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Paid via
          <select name="channel" required value={channel} onChange={(e) => setChannel(e.target.value as ManualPaymentChannel)} className={field}>
            {MANUAL_PAYMENT_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {PAYMENT_CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Payment reference <span className="font-normal text-ink-soft">(optional)</span>
          <input name="paymentReference" maxLength={120} placeholder={PAYMENT_REFERENCE_HINT[channel]} className={field} />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Customer <span className="font-normal text-ink-soft">(optional)</span>
          <input name="customerLabel" maxLength={120} placeholder="e.g. @handle on Instagram" className={field} />
        </label>
      </div>
      <label className="block space-y-2 text-sm font-medium">
        Notes <span className="font-normal text-ink-soft">(optional, admin only)</span>
        <textarea name="notes" maxLength={1000} rows={3} className={field} />
      </label>
      <label className="flex items-start gap-3 rounded-2xl bg-[#fff4e0] px-4 py-3 text-sm">
        <input type="checkbox" name="confirmPaid" value="yes" required checked={paid} onChange={(e) => setPaid(e.target.checked)} className="mt-0.5 accent-rose" />
        <span>I have checked my GCash / Maya / bank / PayPal app and the payment was received.</span>
      </label>
      <Button type="submit" busy={pending} busyLabel="Creating…" disabled={!paid} className="w-full sm:w-auto">
        Create photobooth &amp; private links
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
