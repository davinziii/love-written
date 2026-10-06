"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { createManualOrderAction, type IssueResult } from "@/app/admin/(dash)/actions";
import { IssuedAccessCard } from "./IssuedAccessCard";

const field = "w-full rounded-2xl bg-soft px-4 py-3 text-sm outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-rose/40";

/** Record a manual payment and create the customer's surprise. */
export function ManualOrderForm({
  templates,
  defaultAmountPesos,
  idempotencyKey,
}: {
  templates: { id: string; name: string }[];
  defaultAmountPesos: number;
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState<IssueResult | null, FormData>(createManualOrderAction, null);

  if (state?.ok && state.access) {
    return (
      <div className="space-y-5">
        <IssuedAccessCard access={state.access} />
        {!state.access.customizationLink && <p className="text-sm text-ink-soft">{state.message}</p>}
        <a href="/admin/orders/new" className="inline-flex text-sm text-rose underline underline-offset-4">
          Create another surprise
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Template</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((t, i) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-soft px-4 py-3 text-sm ring-1 ring-transparent has-[:checked]:bg-petal has-[:checked]:ring-rose">
              <input type="radio" name="templateId" value={t.id} defaultChecked={i === 0} className="accent-[var(--color-rose)]" />
              {t.name}
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
          <select name="channel" required defaultValue="gcash" className={field}>
            <option value="gcash">GCash</option>
            <option value="maya">Maya</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium">
          Payment reference <span className="font-normal text-ink-soft">(optional)</span>
          <input name="paymentReference" maxLength={120} placeholder="e.g. GCash ref no." className={field} />
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
        <input type="checkbox" name="confirmPaid" value="yes" required className="mt-0.5 accent-[var(--color-rose)]" />
        <span>I have checked my GCash / Maya / bank app and the payment was received.</span>
      </label>

      <Button type="submit" busy={pending} busyLabel="Creating…" className="w-full sm:w-auto">
        Create surprise &amp; private link
      </Button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}
