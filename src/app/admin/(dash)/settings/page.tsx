import { requireAdmin } from "@/lib/admin/auth";
import { storageStats } from "@/lib/admin/queries";
import { Card, PageTitle, SectionTitle } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icons";
import { env } from "@/lib/env";
import { formatPeso } from "@/lib/format";
import { ORDER_CONTACT, PAYMENT_MODE } from "@/lib/payments/mode";
import { HOSTING_DAYS } from "@/lib/lifecycle";

/** Supabase free plan: 1 GB storage. Upgrade the plan before this gets close. */
const STORAGE_BUDGET_BYTES = 1024 * 1024 * 1024;

/**
 * Read-only view of how the app is configured. Settings live in environment variables
 * (see .env.example) — this page only reports whether each one is set, never its value.
 */
export default async function SettingsPage() {
  await requireAdmin();
  const e = env();
  const storage = await storageStats();
  const pct = Math.round((storage.totalBytes / STORAGE_BUDGET_BYTES) * 100);

  const rows: { label: string; value: string; ok: boolean; hint?: string }[] = [
    {
      label: "Payment workflow",
      value: PAYMENT_MODE === "manual" ? "Manual (DM + admin confirms)" : "PayMongo (automatic)",
      ok: true,
      hint: "NEXT_PUBLIC_PAYMENT_MODE — manual or paymongo",
    },
    {
      label: "Order contact link",
      value: ORDER_CONTACT.url ? ORDER_CONTACT.label : "Not set — customers see “Ordering opens soon”",
      ok: PAYMENT_MODE !== "manual" || Boolean(ORDER_CONTACT.url),
      hint: "NEXT_PUBLIC_ORDER_URL and NEXT_PUBLIC_ORDER_LABEL",
    },
    { label: "Price", value: formatPeso(e.PRICE_CENTAVOS), ok: true, hint: "PRICE_CENTAVOS" },
    {
      label: "PayMongo keys",
      value: e.PAYMONGO_SECRET_KEY && e.PAYMONGO_WEBHOOK_SECRET ? `Configured (${e.PAYMONGO_MODE} mode)` : "Not configured",
      ok: PAYMENT_MODE !== "paymongo" || Boolean(e.PAYMONGO_SECRET_KEY && e.PAYMONGO_WEBHOOK_SECRET),
      hint: "Only required when the payment workflow is PayMongo",
    },
    {
      label: "Bot protection (Turnstile)",
      value: e.TURNSTILE_SECRET_KEY ? "On" : "Off",
      ok: true,
      hint: "TURNSTILE_SECRET_KEY and NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    },
    { label: "Site address", value: e.NEXT_PUBLIC_SITE_URL, ok: !e.NEXT_PUBLIC_SITE_URL.includes("localhost") || process.env.NODE_ENV !== "production" },
    { label: "Hosting period", value: `${HOSTING_DAYS} days after going live`, ok: true },
  ];

  return (
    <>
      <PageTitle title="Settings" subtitle="How Love, Written is configured. Change these in your hosting environment variables." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionTitle title="Configuration" />
          <ul className="divide-y divide-black/[0.05] rounded-2xl bg-white">
            {rows.map((r) => (
              <li key={r.label} className="flex items-start gap-3 px-4 py-3.5">
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${r.ok ? "bg-[#e7f5ec] text-success" : "bg-[#fff4e0] text-[#8a5a00]"}`}>
                  {r.ok ? <Icon.check size={13} strokeWidth={3} /> : <Icon.alert size={13} />}
                  <span className="sr-only">{r.ok ? "OK" : "Needs attention"}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  {r.hint && <p className="font-mono text-[11px] text-ink-soft">{r.hint}</p>}
                </div>
                <p className="max-w-[50%] break-words text-right text-sm text-ink-soft">{r.value}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle title="Storage" />
          <p className="font-display text-4xl tabular-nums">{(storage.totalBytes / 1024 / 1024).toFixed(1)} MB</p>
          <p className="mt-1 text-sm text-ink-soft">{storage.objectCount} photos · {pct}% of the 1 GB free plan</p>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white">
            <div className={`h-full rounded-full ${pct > 80 ? "bg-danger" : "bg-rose"}`} style={{ width: `${Math.min(100, Math.max(1, pct))}%` }} />
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            {[
              ["Active surprises", storage.activeSurprises],
              ["Uploads (30 days)", storage.uploadsLast30Days],
              ["Failed uploads (30 days)", storage.failedUploadsLast30Days],
              ["Cleanup failures", storage.cleanupFailures],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl bg-white px-4 py-3">
                <dt className="text-xs text-ink-soft">{k}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-ink-soft">Bandwidth is shown in the Supabase dashboard under Usage.</p>
        </Card>
      </div>
    </>
  );
}
