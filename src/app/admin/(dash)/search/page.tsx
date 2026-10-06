import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { searchOrders } from "@/lib/admin/queries";
import { Badge, EmptyState, PageTitle, Table, fmt } from "@/components/admin/ui";
import { formatPeso } from "@/lib/format";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  await requireAdmin();
  const q = ((await searchParams).q ?? "").slice(0, 80);
  const results = q ? await searchOrders(q) : [];

  return (
    <>
      <PageTitle title="Search" subtitle={q ? `Orders matching “${q}”` : "Search by order number, customer or payment reference."} />
      {!q ? (
        <EmptyState title="Type in the search bar above" body="For example an order number like LW-20261006, an Instagram handle, or a GCash reference." />
      ) : results.length === 0 ? (
        <EmptyState title="No matching orders" body="Check the spelling, or search with part of the order number." />
      ) : (
        <Table head={["Order", "Customer", "Status", "Amount", "Reference", "Created", ""]}>
          {results.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3 font-mono text-xs">{o.order_number}</td>
              <td className="px-4 py-3">{o.customer_label ?? <span className="text-ink-soft">—</span>}</td>
              <td className="px-4 py-3">{o.surprises && <Badge value={o.surprises.stage} />}</td>
              <td className="px-4 py-3">{formatPeso(o.amount_centavos)}</td>
              <td className="px-4 py-3 font-mono text-xs">{o.payment_reference ?? o.payments[0]?.provider_payment_id ?? "—"}</td>
              <td className="px-4 py-3 text-ink-soft">{fmt(o.created_at)}</td>
              <td className="px-4 py-3 text-right">
                <Link href={`/admin/surprises/${o.surprise_id}`} className="text-rose underline underline-offset-4">
                  View
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
