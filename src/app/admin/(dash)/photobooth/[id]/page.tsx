import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { boothDetail } from "@/lib/admin/queries";
import { participantLinks } from "@/lib/photobooth/session";
import { Badge, Card, PageTitle, fmt } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { BoothLinksCard } from "@/components/admin/BoothLinksCard";
import { formatPeso } from "@/lib/format";
import { PRESENCE_TIMEOUT_MS } from "@/lib/photobooth/constants";
import { deleteBoothNowAction, retryBoothFinalizeAction } from "../actions";

type Props = { params: Promise<{ id: string }> };

/**
 * Support view: everything needed to help a customer (status, payment, camera problems,
 * failures) — and their links to re-send. Tokens themselves are never shown elsewhere.
 */
export default async function PhotoboothDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const b = await boothDetail(id);
  if (!b) notFound();
  const order = b.orders[0];
  const live = ["PAID", "IN_PROGRESS", "GENERATING", "FINALIZATION_FAILED", "COMPLETED"].includes(b.status);
  const links = live ? await participantLinks(b.id) : { a: null, b: null };

  return (
    <>
      <PageTitle title={order?.order_number ?? "Photobooth"} subtitle={`Photobooth · ${b.id}`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Item label="Status"><Badge value={b.status} /></Item>
              <Item label="Payment">
                <span className="flex flex-wrap gap-1">
                  <Badge value={b.payment_status} />
                  {order && <Badge value={order.payment_method === "manual" ? "MANUAL" : "PAYMONGO"} />}
                </span>
              </Item>
              <Item label="Customer">{order?.customer_label ?? "—"}</Item>
              <Item label="Amount">{formatPeso(order?.amount_centavos ?? b.price_centavos)}</Item>
              <Item label="Photo">{b.status === "IN_PROGRESS" ? `${b.current_round} of 4` : b.completed_at ? "4 of 4 ✓" : "—"}</Item>
              <Item label="Design">{b.frame_id ?? "—"}</Item>
              <Item label="Paid">{fmt(b.paid_at)}</Item>
              <Item label="Last activity">{fmt(b.last_activity_at)}</Item>
              <Item label="Completed">{fmt(b.completed_at)}</Item>
              <Item label="Photos deleted after">{fmt(b.expires_at)}</Item>
              <Item label="Cleanup">{b.cleanup_attempts ? `${b.cleanup_attempts} attempt(s)` : "—"}</Item>
              <Item label="Created">{fmt(b.created_at)}</Item>
            </dl>
            {b.generation_error && <p className="mt-4 text-sm text-danger">Strip generation: {b.generation_error}</p>}
            {b.cleanup_error && <p className="mt-2 text-sm text-danger">Cleanup: {b.cleanup_error}</p>}
          </Card>

          <Card>
            <h2 className="font-display text-lg">People</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["A", "B"] as const).map((role) => {
                const p = b.photobooth_participants.find((x) => x.role === role);
                const online = isOnline(p?.last_seen_at ?? null);
                return (
                  <div key={role} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-black/[0.05]">
                    <p className="font-medium">
                      {role === "A" ? "Person A (paid)" : "Person B (invited)"}
                      {p?.display_name ? ` · ${p.display_name}` : ""}
                    </p>
                    {p ? (
                      <ul className="mt-2 space-y-1 text-ink-soft">
                        <li>Joined: {fmt(p.joined_at)}</li>
                        <li>Last seen: {fmt(p.last_seen_at)} {online ? "· online now" : ""}</li>
                        <li>Camera: {p.camera_ready_at ? "working ✓" : "not confirmed yet"}</li>
                        {p.camera_issue && (
                          <li className="text-danger">
                            Camera problem: {p.camera_issue} ({fmt(p.camera_issue_at)})
                          </li>
                        )}
                        <li>7-day notice: {p.deletion_ack_at ? "accepted ✓" : "not yet"}</li>
                      </ul>
                    ) : (
                      <p className="mt-2 text-ink-soft">Removed (photobooth deleted)</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-lg">Actions</h2>
            <div className="mt-4 flex flex-wrap items-start gap-4">
              {(b.status === "FINALIZATION_FAILED" || b.status === "GENERATING") && (
                <ActionForm action={retryBoothFinalizeAction} fields={{ sessionId: b.id }} label="Retry building the strip" variant="primary" />
              )}
              {b.status !== "DELETED" && (
                <ActionForm
                  action={deleteBoothNowAction}
                  fields={{ sessionId: b.id }}
                  label="Delete photos now"
                  variant="danger"
                  confirmText="Permanently delete this photobooth's photos and disable both links?"
                >
                  <input name="confirm" required placeholder='Type "DELETE"' className="rounded-xl border border-line px-3 py-2 text-sm" />
                </ActionForm>
              )}
            </div>
            <p className="mt-4 text-xs text-ink-soft">
              Camera problems never fail a session — the customer can retry, switch devices or come back later. Refunds (if a problem truly
              can&rsquo;t be fixed) are handled outside the app.
            </p>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
          {links.a ? (
            <BoothLinksCard linkA={links.a} linkB={links.b} orderNumber={order?.order_number} />
          ) : (
            <Card>
              <p className="text-sm text-ink-soft">Links are no longer available for this photobooth.</p>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

/** Seen within the presence window (server time of this request). */
function isOnline(lastSeen: string | null): boolean {
  return lastSeen ? Date.now() - new Date(lastSeen).getTime() < PRESENCE_TIMEOUT_MS : false;
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
