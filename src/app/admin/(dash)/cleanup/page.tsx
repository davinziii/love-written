import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listCleanupProblems } from "@/lib/admin/queries";
import { Badge, EmptyState, PageTitle, Table, fmt } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { retryCleanupAction } from "../actions";

/** Deletion queue problems. A surprise is only marked DELETED after deletion is verified. */
export default async function CleanupPage() {
  await requireAdmin();
  const problems = await listCleanupProblems();
  return (
    <>
      <PageTitle
        title="Cleanup"
        subtitle="Expired surprises whose deletion failed. Automatic retries run 3 times (15 min, 1 h, 6 h), then they wait here."
      />
      {problems.length === 0 ? (
        <EmptyState title="No cleanup failures" body="Every expired surprise has been deleted and verified." />
      ) : (
        <Table head={["Surprise", "Status", "Attempts", "Last attempt", "Next retry", "Error / remaining files", ""]}>
          {problems.map((j) => (
            <tr key={j.id}>
              <td className="px-4 py-3">
                <Link href={`/admin/surprises/${j.surprise_id}`} className="font-mono text-xs text-rose underline">
                  {j.surprise_id.slice(0, 8)}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Badge value={j.exhausted ? "CLEANUP_FAILED" : "FAILED"} />
                <span className="ml-1 text-xs text-ink-soft">{j.exhausted ? "needs you" : "auto-retrying"}</span>
              </td>
              <td className="px-4 py-3 tabular-nums">{j.attempts}</td>
              <td className="px-4 py-3 text-ink-soft">{fmt(j.last_attempt_at)}</td>
              <td className="px-4 py-3 text-ink-soft">{j.exhausted ? "—" : fmt(j.next_retry_at)}</td>
              <td className="max-w-xs px-4 py-3 text-xs">
                <p className="text-danger">{j.last_error}</p>
                {j.failed_items.length > 0 && <p className="mt-1 text-ink-soft">{j.failed_items.length} file(s) remaining</p>}
              </td>
              <td className="px-4 py-3">
                <ActionForm action={retryCleanupAction} fields={{ jobId: j.id }} label="Retry cleanup" />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
