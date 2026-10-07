import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listReports } from "@/lib/admin/queries";
import { Badge, Card, EmptyState, PageTitle, fmt } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { CONTENT_REPORT_REASONS, type ContentReportReason } from "@/lib/report-reasons";
import { disableSurpriseAction, resolveReportAction, retryPublishAction } from "../actions";

export default async function ReportsPage() {
  await requireAdmin();
  const reports = await listReports();
  return (
    <>
      <PageTitle
        title="Reports"
        subtitle="Abuse reports from recipients, and customer reports of failed publishes (linked to the exact order and payment)."
      />
      {reports.length === 0 && <EmptyState title="No reports" body="Nobody has reported a problem." />}
      <div className="space-y-4">
        {reports.map((r) => {
          const isContent = r.kind === "content";
          const live = r.surprises && !["DISABLED", "DELETED", "EXPIRED"].includes(r.surprises.stage);
          return (
            <Card key={r.id} className={isContent && r.status === "OPEN" ? "ring-2 ring-danger/30" : ""}>
              <div id={r.report_code} className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base">{r.report_code}</span>
                    <Badge value={r.status} />
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isContent ? "bg-[#fdecea] text-danger" : "bg-white text-ink-soft"}`}>
                      {isContent ? "Abuse report" : "Failed publish"}
                    </span>
                  </p>
                  {isContent ? (
                    <p>
                      Reason:{" "}
                      <strong>{CONTENT_REPORT_REASONS[r.reason as ContentReportReason] ?? r.reason ?? "—"}</strong>
                    </p>
                  ) : (
                    <>
                      <p>
                        Order <span className="font-mono">{r.orders?.order_number ?? "—"}</span> · Reference{" "}
                        <span className="font-mono text-xs">{r.provider_reference ?? "—"}</span>
                      </p>
                      <p className="text-ink-soft">
                        Operation <span className="font-mono text-xs">{r.publish_operation_id}</span> · {r.error_code}
                        {r.error_message ? ` — ${r.error_message}` : ""}
                      </p>
                    </>
                  )}
                  {r.customer_message && <p className="rounded-xl bg-white p-3">&ldquo;{r.customer_message}&rdquo;</p>}
                  <p className="text-xs text-ink-soft">
                    Reported {fmt(r.created_at)} · Surprise now {r.surprises?.stage.replaceAll("_", " ").toLowerCase()}
                  </p>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {!isContent && r.surprises?.stage === "PUBLISH_FAILED" && (
                    <ActionForm action={retryPublishAction} fields={{ surpriseId: r.surprise_id }} label="Retry Publish" variant="primary" />
                  )}
                  {isContent && live && (
                    <ActionForm
                      action={disableSurpriseAction}
                      fields={{ surpriseId: r.surprise_id, reason: `Abuse report ${r.report_code}` }}
                      label="Disable surprise"
                      variant="danger"
                      confirmText="Take this surprise offline? The recipient will see that it's unavailable."
                    />
                  )}
                  {r.status === "OPEN" && <ActionForm action={resolveReportAction} fields={{ reportId: r.id }} label="Mark resolved" />}
                  <Link href={`/admin/surprises/${r.surprise_id}`} className="rounded-full bg-white px-4 py-2 text-sm ring-1 ring-black/[0.06]">
                    {isContent ? "Review surprise" : "View order"}
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
