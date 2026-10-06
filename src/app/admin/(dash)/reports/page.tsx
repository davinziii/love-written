import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listReports } from "@/lib/admin/queries";
import { Badge, Card, Empty, PageTitle, fmt } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { resolveReportAction, retryPublishAction } from "../actions";

export default async function ReportsPage() {
  await requireAdmin();
  const reports = await listReports();
  return (
    <>
      <PageTitle title="Reports" subtitle="Customer reports of failed publishes, linked to the exact order, payment and operation." />
      {reports.length === 0 && <Empty text="No reports." />}
      <div className="space-y-4">
        {reports.map((r) => (
          <Card key={r.id}>
            <div id={r.report_code} className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 text-sm">
                <p className="font-mono text-base">{r.report_code} <Badge value={r.status} /></p>
                <p>Order <span className="font-mono">{r.orders?.order_number ?? "—"}</span> · PayMongo <span className="font-mono text-xs">{r.provider_reference ?? "—"}</span></p>
                <p className="text-ink-soft">
                  Operation <span className="font-mono text-xs">{r.publish_operation_id}</span> · {r.error_code}
                  {r.error_message ? ` — ${r.error_message}` : ""}
                </p>
                {r.customer_message && <p className="rounded-xl bg-cream p-3">&ldquo;{r.customer_message}&rdquo;</p>}
                <p className="text-xs text-ink-soft">
                  Reported {fmt(r.created_at)} · Surprise now {r.surprises?.stage.replaceAll("_", " ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.surprises?.stage === "PUBLISH_FAILED" && (
                  <ActionForm action={retryPublishAction} fields={{ surpriseId: r.surprise_id }} label="Retry Publish" variant="primary" />
                )}
                {r.status === "OPEN" && <ActionForm action={resolveReportAction} fields={{ reportId: r.id }} label="Mark resolved" />}
                <Link href={`/admin/surprises/${r.surprise_id}`} className="rounded-full px-4 py-2 text-sm ring-1 ring-line">
                  View Order
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
