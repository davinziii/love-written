import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminSurprise } from "@/lib/admin/queries";
import { getTemplate } from "@/templates";
import { formatPeso } from "@/lib/format";
import { HeartIcon, Icon, type IconName } from "@/components/ui/icons";

/** Admin design system: white main container, #F8F9FA cards, pills, generous radius. */

export function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));
}

/* ─── Status pills ─────────────────────────────────────────────────────────── */

const PILL: Record<string, { label?: string; cls: string; dot: string }> = {
  DRAFT: { label: "Draft", cls: "bg-[#eef0f3] text-[#4a5160]", dot: "bg-[#8a93a3]" },
  CUSTOMIZING: { label: "Draft", cls: "bg-[#eef0f3] text-[#4a5160]", dot: "bg-[#8a93a3]" },
  READY_TO_PUBLISH: { label: "Ready", cls: "bg-[#fff4e0] text-[#8a5a00]", dot: "bg-[#e0a02a]" },
  SCHEDULED: { label: "Scheduled", cls: "bg-[#e9eefb] text-[#2f4f9a]", dot: "bg-[#3f6fb5]" },
  PUBLISHED: { label: "Published", cls: "bg-[#e7f5ec] text-[#22683f]", dot: "bg-[#2f9a5a]" },
  PUBLISH_FAILED: { label: "Publish failed", cls: "bg-[#fdecea] text-[#9b241c]", dot: "bg-[#d0453b]" },
  EXPIRED: { label: "Expired", cls: "bg-[#f1ece9] text-[#6f5960]", dot: "bg-[#b49b93]" },
  CLEANUP_FAILED: { label: "Cleanup failed", cls: "bg-[#fdecea] text-[#9b241c]", dot: "bg-[#d0453b]" },
  DELETED: { label: "Deleted", cls: "bg-[#f1ece9] text-[#6f5960]", dot: "bg-[#b49b93]" },
  DISABLED: { label: "Disabled", cls: "bg-ink text-cream", dot: "bg-cream" },
  PAID: { label: "Paid", cls: "bg-[#e7f5ec] text-[#22683f]", dot: "bg-[#2f9a5a]" },
  UNPAID: { label: "Unpaid", cls: "bg-[#eef0f3] text-[#4a5160]", dot: "bg-[#8a93a3]" },
  AWAITING_PAYMENT: { label: "Awaiting payment", cls: "bg-[#fff4e0] text-[#8a5a00]", dot: "bg-[#e0a02a]" },
  PAYMENT_FAILED: { label: "Payment failed", cls: "bg-[#fdecea] text-[#9b241c]", dot: "bg-[#d0453b]" },
  SUCCEEDED: { label: "Succeeded", cls: "bg-[#e7f5ec] text-[#22683f]", dot: "bg-[#2f9a5a]" },
  FAILED: { label: "Failed", cls: "bg-[#fdecea] text-[#9b241c]", dot: "bg-[#d0453b]" },
  RUNNING: { label: "Running", cls: "bg-[#e9eefb] text-[#2f4f9a]", dot: "bg-[#3f6fb5]" },
  PENDING: { label: "Pending", cls: "bg-[#fff4e0] text-[#8a5a00]", dot: "bg-[#e0a02a]" },
  OPEN: { label: "Open", cls: "bg-[#fff4e0] text-[#8a5a00]", dot: "bg-[#e0a02a]" },
  RESOLVED: { label: "Resolved", cls: "bg-[#e7f5ec] text-[#22683f]", dot: "bg-[#2f9a5a]" },
  MANUAL: { label: "Manual", cls: "bg-petal text-rose-deep", dot: "bg-rose" },
  PAYMONGO: { label: "PayMongo", cls: "bg-[#e9eefb] text-[#2f4f9a]", dot: "bg-[#3f6fb5]" },
  LISTED: { label: "Listed", cls: "bg-[#e7f5ec] text-[#22683f]", dot: "bg-[#2f9a5a]" },
  HIDDEN: { label: "Hidden", cls: "bg-[#eef0f3] text-[#4a5160]", dot: "bg-[#8a93a3]" },
};

/** Status pill: a dot + a word, so state is never conveyed by color alone. */
export function Badge({ value }: { value: string }) {
  const p = PILL[value] ?? { cls: "bg-soft text-ink-soft ring-1 ring-black/5", dot: "bg-ink-soft" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${p.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} aria-hidden />
      {p.label ?? value.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}

/* ─── Layout pieces ────────────────────────────────────────────────────────── */

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ children, className = "", tone = "soft" }: { children: ReactNode; className?: string; tone?: "soft" | "white" }) {
  return (
    <div className={`rounded-3xl p-5 sm:p-6 ${tone === "soft" ? "bg-soft" : "bg-white ring-1 ring-black/[0.06]"} ${className}`}>{children}</div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

export function PrimaryLink({ href, children, icon = "plus" }: { href: string; children: ReactNode; icon?: IconName }) {
  const Glyph = Icon[icon];
  return (
    <Link
      href={href}
      className="lw-press inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_20px_-10px_rgba(43,29,34,0.6)] hover:bg-rose"
    >
      <Glyph size={16} />
      {children}
    </Link>
  );
}

export function SoftLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="lw-press inline-flex items-center gap-2 rounded-full bg-soft px-4 py-2 text-sm font-medium text-ink ring-1 ring-black/[0.06] hover:bg-white">
      {children}
    </Link>
  );
}

/** Stat card: big real number, a short label, an icon. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: IconName;
  href?: string;
  accent?: boolean;
}) {
  const Glyph = Icon[icon];
  const body = (
    <div
      className={`group relative h-full overflow-hidden rounded-3xl p-5 transition duration-300 sm:p-6 ${
        accent ? "bg-ink text-cream" : "bg-soft hover:bg-[#f2f3f5]"
      }`}
    >
      <div className="flex items-start justify-between">
        <p className={`text-sm ${accent ? "text-cream/70" : "text-ink-soft"}`}>{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-full ${accent ? "bg-rose text-white" : "bg-white text-rose shadow-sm"}`}>
          <Glyph size={18} />
        </span>
      </div>
      <p className="mt-3 font-display text-4xl tracking-tight tabular-nums sm:text-5xl">{value}</p>
      {hint && <p className={`mt-2 text-xs ${accent ? "text-cream/60" : "text-ink-soft"}`}>{hint}</p>}
      {href && (
        <span className={`absolute bottom-5 right-5 transition group-hover:translate-x-1 ${accent ? "text-cream/60" : "text-ink-soft"}`} aria-hidden>
          <Icon.arrowRight size={16} />
        </span>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-3xl focus-visible:ring-2 focus-visible:ring-rose">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Friendly empty state — never a blank box. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-soft px-6 py-12 text-center">
      <div className="relative mx-auto grid h-16 w-16 place-items-center">
        <span className="absolute inset-0 rotate-6 rounded-2xl bg-petal" aria-hidden />
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white text-rose shadow-sm">
          <HeartIcon size={24} />
        </span>
      </div>
      <p className="mt-5 font-display text-xl">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/** Back-compat alias used by older pages. */
export function Empty({ text }: { text: string }) {
  return <EmptyState title={text} />;
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-3xl bg-soft p-2">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-xs text-ink-soft">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:bg-white [&>tr>td:first-child]:rounded-l-2xl [&>tr>td:last-child]:rounded-r-2xl [&>tr]:border-y-[6px] [&>tr]:border-soft">
          {children}
        </tbody>
      </table>
    </div>
  );
}

/** Name of a surprise for lists — from the template's displayField (e.g. recipient name). */
export function surpriseName(s: { template_id: string; content?: Record<string, string> | null }): string | null {
  const field = getTemplate(s.template_id)?.displayField;
  return (field && s.content?.[field]?.trim()) || null;
}

/**
 * "Your Surprises" list: cards on mobile, a compact table from md up.
 */
export function SurpriseList({
  rows,
  dateLabel = "Updated",
  dateOf = (r) => r.updated_at,
  emptyTitle = "No surprises here yet",
  emptyAction,
}: {
  rows: AdminSurprise[];
  dateLabel?: string;
  dateOf?: (r: AdminSurprise) => string | null;
  emptyTitle?: string;
  emptyAction?: ReactNode;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} action={emptyAction} />;
  return (
    <>
      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => {
          const order = r.orders.find((o) => o.status === "PAID") ?? r.orders[0];
          return (
            <li key={r.id}>
              <Link href={`/admin/surprises/${r.id}`} className="block rounded-3xl bg-soft p-4 active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{surpriseName(r) ?? "Untitled surprise"}</p>
                    <p className="text-xs text-ink-soft">
                      {getTemplate(r.template_id)?.name ?? r.template_id} · {order?.order_number ?? "no order"}
                    </p>
                  </div>
                  <Badge value={r.stage} />
                </div>
                <p className="mt-3 text-xs text-ink-soft">
                  {dateLabel}: {fmt(dateOf(r))}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table head={["Recipient", "Template", "Status", "Payment", dateLabel, ""]}>
          {rows.map((r) => {
            const order = r.orders.find((o) => o.status === "PAID") ?? r.orders[0];
            const name = surpriseName(r);
            return (
              <tr key={r.id} className="transition hover:bg-[#fffafb]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-petal text-sm font-semibold text-rose" aria-hidden>
                      {name ? name.slice(0, 1).toUpperCase() : <HeartIcon size={14} />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{name ?? <span className="text-ink-soft">Not written yet</span>}</p>
                      <p className="font-mono text-[11px] text-ink-soft">{order?.order_number ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{getTemplate(r.template_id)?.name ?? r.template_id}</td>
                <td className="px-4 py-3">
                  <Badge value={r.stage} />
                  {r.stage === "SCHEDULED" && <p className="mt-1 text-[11px] text-ink-soft">{fmt(r.scheduled_for)}</p>}
                </td>
                <td className="px-4 py-3">
                  <Badge value={r.payment_status} />
                  {order && <span className="ml-2 text-xs text-ink-soft">{formatPeso(order.amount_centavos)}</span>}
                </td>
                <td className="px-4 py-3 text-ink-soft">{fmt(dateOf(r))}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/surprises/${r.id}`}
                    className="lw-press inline-flex items-center gap-1 rounded-full bg-soft px-3 py-1.5 text-xs font-medium hover:bg-petal hover:text-rose"
                  >
                    View <Icon.arrowRight size={13} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </Table>
      </div>
    </>
  );
}

/** Back-compat wrapper for the previous table API. */
export function SurpriseTable({ rows, dateLabel, dateOf }: { rows: AdminSurprise[]; dateLabel: string; dateOf: (r: AdminSurprise) => string | null }) {
  return <SurpriseList rows={rows} dateLabel={dateLabel} dateOf={dateOf} />;
}
