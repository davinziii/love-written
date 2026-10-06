import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { attentionCounts, dashboardKpis, dashboardStats, listSurprises, surpriseActivity } from "@/lib/admin/queries";
import { Card, PageTitle, PrimaryLink, SectionTitle, SoftLink, StatCard, SurpriseList } from "@/components/admin/ui";
import { ActivityChart } from "@/components/admin/ActivityChart";
import { Icon } from "@/components/ui/icons";
import { formatPeso } from "@/lib/format";
import { isManualPayments } from "@/lib/payments/mode";

export default async function AdminDashboard() {
  await requireAdmin();
  const [kpi, activity, recent, attention, stats] = await Promise.all([
    dashboardKpis(),
    surpriseActivity(14),
    listSurprises("all", 6),
    attentionCounts(),
    dashboardStats(),
  ]);
  const createHref = isManualPayments ? "/admin/orders/new" : "/surprises";
  const attentionItems = [
    { n: attention.failedPublish, href: "/admin/failed-publish", text: "Paid surprises failed to publish", icon: Icon.alert },
    { n: attention.openReports, href: "/admin/reports", text: "Open customer reports", icon: Icon.flag },
    { n: attention.cleanupFailed, href: "/admin/cleanup", text: "Deletions need a retry", icon: Icon.trash },
  ];
  const top = stats.funnel[0]?.count || 1;

  return (
    <>
      <PageTitle
        title="Dashboard"
        subtitle="Create, manage, and share your written surprises."
        actions={
          <>
            <SoftLink href="/admin/surprises">View all</SoftLink>
            <PrimaryLink href={createHref}>Create Surprise</PrimaryLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard accent label="Total surprises" value={kpi.total} icon="gift" hint={`${kpi.newThisWeek} new in the last 7 days`} href="/admin/surprises" />
        <StatCard label="Published" value={kpi.published} icon="send" hint="Live right now" href="/admin/surprises?view=published" />
        <StatCard label="Scheduled" value={kpi.scheduled} icon="calendar" hint="Waiting for their reveal" href="/admin/surprises?view=scheduled" />
        <StatCard label="Drafts" value={kpi.drafts} icon="pen" hint="Being written by customers" href="/admin/surprises?view=drafts" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <SectionTitle title="Surprise activity" action={<span className="text-xs text-ink-soft">Last 14 days · Manila time</span>} />
          <ActivityChart data={activity} />
        </Card>

        <Card>
          <SectionTitle title="Needs attention" />
          <ul className="space-y-2">
            {attentionItems.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm transition hover:shadow-sm"
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${a.n ? "bg-[#fdecea] text-danger" : "bg-soft text-ink-soft"}`}>
                    <a.icon size={17} />
                  </span>
                  <span className="flex-1">{a.text}</span>
                  <span className={`font-semibold tabular-nums ${a.n ? "text-danger" : "text-ink-soft"}`}>{a.n}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white px-4 py-3">
              <p className="text-xs text-ink-soft">Revenue this month</p>
              <p className="mt-1 font-display text-2xl">{formatPeso(stats.revenueThisMonth)}</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3">
              <p className="text-xs text-ink-soft">Paid orders this month</p>
              <p className="mt-1 font-display text-2xl">{stats.customersThisMonth}</p>
            </div>
          </div>
        </Card>
      </div>

      <section className="mt-8">
        <SectionTitle title="Your surprises" action={<SoftLink href="/admin/surprises">See all</SoftLink>} />
        <SurpriseList
          rows={recent}
          emptyTitle="You haven't created a surprise yet."
          emptyAction={<PrimaryLink href={createHref}>Create Your First Surprise</PrimaryLink>}
        />
      </section>

      <section className="mt-8">
        <Card>
          <SectionTitle title="Funnel" action={<span className="text-xs text-ink-soft">Last 30 days</span>} />
          {stats.funnel.every((s) => s.count === 0) ? (
            <p className="text-sm text-ink-soft">No visits recorded yet. Funnel numbers appear as people use the site.</p>
          ) : (
            <ol className="space-y-3">
              {stats.funnel.map((step, i) => {
                const prev = i > 0 ? stats.funnel[i - 1]!.count : null;
                const conv = prev ? Math.round((step.count / prev) * 100) : null;
                return (
                  <li key={step.event} className="grid grid-cols-[minmax(0,10rem)_1fr_4.5rem] items-center gap-3 text-sm">
                    <span className="truncate text-ink-soft">{step.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-white">
                      <span className="block h-full rounded-full bg-rose" style={{ width: `${Math.min(100, (step.count / top) * 100)}%` }} />
                    </span>
                    <span className="text-right tabular-nums">
                      {step.count}
                      {conv !== null && <span className="ml-1 text-xs text-ink-soft">{conv}%</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </section>
    </>
  );
}
