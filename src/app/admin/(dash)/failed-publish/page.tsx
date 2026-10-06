import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listFailedPublishes } from "@/lib/admin/queries";
import { Badge, Card, Empty, PageTitle, fmt } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { formatPeso } from "@/lib/format";
import { getTemplate } from "@/templates";
import { retryPublishAction } from "../actions";

export default async function FailedPublishPage() {
  await requireAdmin();
  const items = await listFailedPublishes();
  return (
    <>
      <PageTitle title="Failed Publish" subtitle="Paid surprises that failed to publish. Retrying never charges the customer again." />
      {items.length === 0 && <Empty text="No failed publishes. 🎉" />}
      <div className="space-y-4">
        {items.map(({ surprise, order, payment, operation, report }) => (
          <Card key={surprise.id}>
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <Field label="Order">{order?.order_number ?? "—"}</Field>
                <Field label="Template">{getTemplate(surprise.template_id)?.name ?? surprise.template_id}</Field>
                <Field label="Payment"><Badge value={surprise.payment_status} /></Field>
                <Field label="Amount">{order ? formatPeso(order.amount_centavos) : "—"}</Field>
                <Field label="PayMongo reference">
                  <span className="font-mono text-xs">{payment?.provider_payment_id ?? order?.checkout_session_id ?? "—"}</span>
                </Field>
                <Field label="Publishing"><Badge value="FAILED" /></Field>
                <Field label="Reason">
                  <span className="font-mono text-xs">{operation?.error_code ?? "—"}</span>
                  {operation?.error_message && <span className="block text-xs text-ink-soft">{operation.error_message}</span>}
                </Field>
                <Field label="Attempted">{fmt(operation?.finished_at ?? operation?.started_at)}</Field>
                <Field label="Report">{report ? <span className="font-mono text-xs">{report.report_code}</span> : "—"}</Field>
              </dl>
              <div className="flex flex-wrap items-start gap-2 md:flex-col">
                <ActionForm action={retryPublishAction} fields={{ surpriseId: surprise.id }} label="Retry Publish" variant="primary" />
                <Link href={`/admin/surprises/${surprise.id}`} className="rounded-full px-4 py-2 text-sm ring-1 ring-line hover:ring-ink/30">
                  View Order
                </Link>
                {report && (
                  <Link href={`/admin/reports#${report.report_code}`} className="rounded-full px-4 py-2 text-sm ring-1 ring-line hover:ring-ink/30">
                    View Report
                  </Link>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
