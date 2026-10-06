import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { Card, PageTitle } from "@/components/admin/ui";
import { ManualOrderForm } from "@/components/admin/ManualOrderForm";
import { Icon } from "@/components/ui/icons";
import { listedTemplates } from "@/templates";
import { priceCentavos } from "@/lib/price";
import { isManualPayments } from "@/lib/payments/mode";

const STEPS = [
  { icon: Icon.wallet, text: "Confirm the payment in your GCash / Maya / bank app." },
  { icon: Icon.gift, text: "Create the surprise here — it is marked as paid." },
  { icon: Icon.send, text: "DM the customer their private link and recovery code." },
  { icon: Icon.pen, text: "They customize, then publish now or schedule it." },
];

export default async function NewManualOrderPage() {
  await requireAdmin();
  // One key per page load: a double-submit of this form creates exactly one order.
  const idempotencyKey = randomUUID();

  return (
    <>
      <PageTitle title="Create Surprise" subtitle="Record a payment you received and send the customer their private link." />
      {!isManualPayments && (
        <p className="mb-6 rounded-2xl bg-[#fff4e0] px-4 py-3 text-sm">
          Payments are currently set to PayMongo. You can still create a manually paid surprise here (for example a gift or a
          payment received outside the site).
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card tone="white">
          <ManualOrderForm
            templates={listedTemplates().map((t) => ({ id: t.id, name: t.name }))}
            defaultAmountPesos={priceCentavos() / 100}
            idempotencyKey={idempotencyKey}
          />
        </Card>
        <Card>
          <h2 className="font-semibold">How the manual flow works</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.text} className="flex gap-3 text-sm">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-rose shadow-sm">
                  <s.icon size={16} />
                </span>
                <span className="pt-1.5">
                  <span className="text-ink-soft">{i + 1}.</span> {s.text}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs leading-relaxed text-ink-soft">
            The customer never needs an account. Their link signs them in on their device; the recovery code works on any
            device. Publishing, scheduling, the 30-day lifetime and deletion all work exactly as with automatic payments.
          </p>
        </Card>
      </div>
    </>
  );
}
