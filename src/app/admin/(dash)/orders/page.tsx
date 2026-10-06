import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listOrders } from "@/lib/admin/queries";
import { Badge, EmptyState, PageTitle, PrimaryLink, Table, fmt } from "@/components/admin/ui";
import { formatPeso } from "@/lib/format";
import { getTemplate } from "@/templates";

const CHANNEL: Record<string, string> = { gcash: "GCash", maya: "Maya", bank_transfer: "Bank", other: "Other" };

export default async function OrdersPage() {
  await requireAdmin();
  const orders = await listOrders();
  return (
    <>
      <PageTitle
        title="Orders"
        subtitle="Every order and payment. Only one order per surprise can be open or paid."
        actions={<PrimaryLink href="/admin/orders/new">Create Surprise</PrimaryLink>}
      />
      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          body="When a customer pays, record it with Create Surprise to send them their private link."
          action={<PrimaryLink href="/admin/orders/new">Create Your First Surprise</PrimaryLink>}
        />
      ) : (
        <Table head={["Order", "Customer", "Template", "Payment", "Amount", "Reference", "Surprise", "Created", ""]}>
          {orders.map((o) => {
            const payment = o.payments[0];
            return (
              <tr key={o.id}>
                <td className="px-4 py-3 font-mono text-xs">{o.order_number}</td>
                <td className="px-4 py-3">{o.customer_label ?? <span className="text-ink-soft">—</span>}</td>
                <td className="px-4 py-3 text-ink-soft">{getTemplate(o.surprises?.template_id ?? "")?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Badge value={o.status} />
                    <Badge value={o.payment_method === "manual" ? "MANUAL" : "PAYMONGO"} />
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{formatPeso(o.amount_centavos)}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {o.payment_method === "manual"
                    ? [payment?.method ? CHANNEL[payment.method] ?? payment.method : null, o.payment_reference].filter(Boolean).join(" · ") || "—"
                    : payment?.provider_payment_id ?? o.checkout_session_id ?? "—"}
                </td>
                <td className="px-4 py-3">{o.surprises && <Badge value={o.surprises.stage} />}</td>
                <td className="px-4 py-3 text-ink-soft">{fmt(o.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/surprises/${o.surprise_id}`} className="text-rose underline underline-offset-4">
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
