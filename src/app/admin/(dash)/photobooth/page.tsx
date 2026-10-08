import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listBooths, type BoothListView } from "@/lib/admin/queries";
import { Badge, EmptyState, PageTitle, PrimaryLink, Table, fmt } from "@/components/admin/ui";
import { LinkPending } from "@/components/ui/LinkPending";
import { Icon } from "@/components/ui/icons";
import { formatPeso } from "@/lib/format";

const TABS: { view: BoothListView; label: string }[] = [
  { view: "all", label: "All" },
  { view: "active", label: "In progress" },
  { view: "completed", label: "Completed" },
  { view: "attention", label: "Needs attention" },
];

type Props = { searchParams: Promise<{ view?: string }> };

export default async function PhotoboothAdminPage({ searchParams }: Props) {
  await requireAdmin();
  const requested = (await searchParams).view;
  const tab = TABS.find((t) => t.view === requested) ?? TABS[0]!;
  const rows = await listBooths(tab.view);

  return (
    <>
      <PageTitle
        title="Photobooth"
        subtitle="Paid two-person photobooth sessions. Photos are deleted 7 days after a session is completed."
        actions={<PrimaryLink href="/admin/photobooth/new">Create Photobooth</PrimaryLink>}
      />
      {rows === null ? (
        <EmptyState title="Photobooth isn't set up yet" body="Run supabase/migrations/0005_photobooth.sql in the Supabase SQL editor, then reload this page." />
      ) : (
        <>
          <nav aria-label="Filter photobooths" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1">
            {TABS.map((t) => {
              const active = t.view === tab.view;
              return (
                <Link
                  key={t.view}
                  href={t.view === "all" ? "/admin/photobooth" : `/admin/photobooth?view=${t.view}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${
                    active ? "bg-ink text-white shadow-sm" : "bg-soft text-ink-soft hover:bg-[#eef0f3] hover:text-ink"
                  }`}
                >
                  {t.label}
                  <LinkPending />
                </Link>
              );
            })}
          </nav>
          {rows.length === 0 ? (
            <EmptyState title="No photobooths here" body="Paid photobooth sessions will appear here." />
          ) : (
            <Table head={["Order", "Customer", "Status", "Photo", "People", "Completed", "Expires", ""]}>
              {rows.map((b) => {
                const order = b.orders[0];
                const people = b.photobooth_participants;
                const issue = people.find((p) => p.camera_issue);
                return (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-mono text-xs">{order?.order_number ?? "—"}</td>
                    <td className="px-4 py-3">{order?.customer_label ?? <span className="text-ink-soft">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge value={b.status} />
                        {issue && <Badge value="CAMERA_ISSUE" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{b.status === "IN_PROGRESS" ? `${b.current_round} / 4` : "—"}</td>
                    <td className="px-4 py-3 text-xs text-ink-soft">{people.filter((p) => p.joined_at).length} / 2 joined</td>
                    <td className="px-4 py-3 text-ink-soft">{fmt(b.completed_at)}</td>
                    <td className="px-4 py-3 text-ink-soft">{fmt(b.expires_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/photobooth/${b.id}`}
                        className="lw-press inline-flex items-center gap-1 rounded-full bg-soft px-3 py-1.5 text-xs font-medium hover:bg-petal hover:text-rose"
                      >
                        View <Icon.arrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
          <p className="mt-4 text-xs text-ink-soft">Price per session: {formatPeso(rows[0]?.price_centavos ?? 5000)} · unpaid checkouts are hidden.</p>
        </>
      )}
    </>
  );
}
