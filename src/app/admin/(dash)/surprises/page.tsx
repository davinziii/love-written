import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listSurprises, type AdminSurprise, type SurpriseListView } from "@/lib/admin/queries";
import { PageTitle, PrimaryLink, SurpriseList } from "@/components/admin/ui";
import { isManualPayments } from "@/lib/payments/mode";
import { LinkPending } from "@/components/ui/LinkPending";

const TABS: { view: SurpriseListView; label: string; dateLabel: string; dateOf: (r: AdminSurprise) => string | null; empty: string }[] = [
  { view: "all", label: "All", dateLabel: "Updated", dateOf: (r) => r.updated_at, empty: "No surprises yet." },
  { view: "drafts", label: "Drafts", dateLabel: "Updated", dateOf: (r) => r.updated_at, empty: "No drafts in progress." },
  { view: "scheduled", label: "Scheduled", dateLabel: "Reveals", dateOf: (r) => r.scheduled_for, empty: "Nothing scheduled." },
  { view: "published", label: "Published", dateLabel: "Expires", dateOf: (r) => r.expires_at, empty: "No live surprises right now." },
  { view: "expiring", label: "Expiring soon", dateLabel: "Expires", dateOf: (r) => r.expires_at, empty: "Nothing expires in the next 3 days." },
  { view: "expired", label: "Expired", dateLabel: "Expired", dateOf: (r) => r.expires_at, empty: "No expired surprises." },
];

type Props = { searchParams: Promise<{ view?: string }> };

export default async function SurprisesPage({ searchParams }: Props) {
  await requireAdmin();
  const requested = (await searchParams).view;
  const tab = TABS.find((t) => t.view === requested) ?? TABS[0]!;
  const rows = await listSurprises(tab.view);

  return (
    <>
      <PageTitle
        title="Surprises"
        subtitle="Every surprise, from first draft to deletion."
        actions={<PrimaryLink href={isManualPayments ? "/admin/orders/new" : "/surprises"}>Create Surprise</PrimaryLink>}
      />
      <nav aria-label="Filter surprises" className="-mx-1 mb-6 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const active = t.view === tab.view;
          return (
            <Link
              key={t.view}
              href={t.view === "all" ? "/admin/surprises" : `/admin/surprises?view=${t.view}`}
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
      <SurpriseList rows={rows} dateLabel={tab.dateLabel} dateOf={tab.dateOf} emptyTitle={tab.empty} />
    </>
  );
}
