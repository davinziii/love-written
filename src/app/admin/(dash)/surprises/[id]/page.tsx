import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { surpriseDetail } from "@/lib/admin/queries";
import { mediaUrlsByField, publicUrl } from "@/lib/surprises/repo";
import { Badge, Card, PageTitle, Table, fmt } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { ReissueAccess } from "@/components/admin/ReissueAccess";
import { PhoneFrame } from "@/components/preview/PhoneFrame";
import { TemplateExperience } from "@/templates/renderers";
import { buildRenderData } from "@/templates/render-data";
import { getTemplate, isTemplateId } from "@/templates";
import { formatPeso } from "@/lib/format";
import { canEdit, UNPUBLISHED_PAID_TTL_DAYS } from "@/lib/lifecycle";
import { loadAccess } from "@/lib/security/access-vault";
import { customizationLink } from "@/lib/payments/manual";
import { IssuedAccessCard } from "@/components/admin/IssuedAccessCard";
import { deleteNowAction, disableSurpriseAction, retryPublishAction } from "../../actions";

type Props = { params: Promise<{ id: string }> };

export default async function SurpriseDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await surpriseDetail(id);
  if (!s) notFound();

  const template = getTemplate(s.template_id);
  const media = s.media ?? [];
  const urls = media.length ? await mediaUrlsByField(media).catch(() => ({})) : {};
  const order = s.orders.find((o) => o.status === "PAID") ?? s.orders[0];
  const cleanup = Array.isArray(s.cleanup_jobs) ? s.cleanup_jobs[0] : s.cleanup_jobs;
  const ops = [...s.publish_operations].sort((a, b) => b.started_at.localeCompare(a.started_at));
  const link = publicUrl(s.public_token);
  const hasContent = Object.keys(s.content ?? {}).length > 0;
  // While it can still be edited, admins can re-send the customer's private link.
  const saved = canEdit(s.stage) ? await loadAccess(s.id) : null;

  return (
    <>
      <PageTitle title={order?.order_number ?? "Surprise"} subtitle={`${template?.name ?? s.template_id} · ${s.id}`} />

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Item label="Stage"><Badge value={s.stage} /></Item>
              <Item label="Payment">
                <span className="flex flex-wrap gap-1">
                  <Badge value={s.payment_status} />
                  {order && <Badge value={order.payment_method === "manual" ? "MANUAL" : "PAYMONGO"} />}
                </span>
              </Item>
              <Item label="Customer">{order?.customer_label ?? "—"}</Item>
              <Item label="Amount">{order ? formatPeso(order.amount_centavos) : "—"}</Item>
              <Item label="Payment reference">
                <span className="font-mono text-xs">
                  {order?.payment_method === "manual" ? order.payment_reference ?? "—" : order?.payments[0]?.provider_payment_id ?? order?.checkout_session_id ?? "—"}
                </span>
              </Item>
              <Item label="Created">{fmt(s.created_at)}</Item>
              <Item label="Reveal">{s.reveal_mode === "schedule" ? fmt(s.scheduled_for) : "Now"}</Item>
              <Item label="Published">{fmt(s.published_at)}</Item>
              <Item label="Expires">{fmt(s.expires_at)}</Item>
              <Item label="Opens">{s.open_count} {s.first_opened_at ? `(first ${fmt(s.first_opened_at)})` : ""}</Item>
              <Item label="Locked">{fmt(s.locked_at)}</Item>
              <Item label="Last customer visit">
                {fmt(s.last_customer_activity_at)}
                {s.payment_status === "PAID" && ["DRAFT", "CUSTOMIZING", "READY_TO_PUBLISH"].includes(s.stage) && (
                  <span className="block text-xs text-ink-soft">
                    Deleted if not opened by {fmt(new Date(new Date(s.last_customer_activity_at).getTime() + UNPUBLISHED_PAID_TTL_DAYS * 86_400_000).toISOString())}
                  </span>
                )}
              </Item>
              <Item label="Cleanup">{cleanup ? <Badge value={cleanup.status} /> : "—"}</Item>
              <Item label="Photos">{media.length} · {(media.reduce((n, m) => n + m.bytes, 0) / 1024).toFixed(0)} KB</Item>
            </dl>
            {link && (
              <p className="mt-4 break-all text-xs">
                Link: <a href={link} target="_blank" rel="noopener noreferrer" className="text-rose underline">{link}</a>
              </p>
            )}
            {s.disabled_reason && <p className="mt-2 text-sm text-danger">Disabled: {s.disabled_reason}</p>}
          </Card>

          {saved ? (
            <IssuedAccessCard
              saved
              access={{
                surpriseId: s.id,
                orderNumber: order?.order_number ?? "",
                customizationLink: customizationLink(s.id, saved.editToken, saved.recoveryCode),
                recoveryCode: saved.recoveryCode,
                replayed: false,
              }}
            />
          ) : (
            canEdit(s.stage) && (
              <Card>
                <h2 className="text-sm font-semibold">Customer edit link</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  No saved copy for this surprise (it was issued before links were saved). Use <strong>New customer link</strong> below to
                  issue one &mdash; the customer&rsquo;s old link will stop working.
                </p>
              </Card>
            )
          )}

          {order?.notes && (
            <Card>
              <h2 className="text-sm font-semibold">Notes</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{order.notes}</p>
            </Card>
          )}

          <Card>
            <h2 className="font-display text-lg">Actions</h2>
            <div className="mt-4 flex flex-wrap items-start gap-4">
              {s.stage !== "DELETED" && <ReissueAccess surpriseId={s.id} />}
              {s.stage === "PUBLISH_FAILED" && (
                <ActionForm action={retryPublishAction} fields={{ surpriseId: s.id }} label="Retry Publish" variant="primary" />
              )}
              {s.stage !== "DELETED" && s.stage !== "DISABLED" && (
                <ActionForm action={disableSurpriseAction} fields={{ surpriseId: s.id }} label="Disable surprise" confirmText="Take this surprise offline?">
                  <input name="reason" required minLength={3} placeholder="Reason" className="rounded-xl border border-line px-3 py-2 text-sm" />
                </ActionForm>
              )}
              {s.stage !== "DELETED" && (
                <ActionForm action={deleteNowAction} fields={{ surpriseId: s.id }} label="Delete now" variant="danger" confirmText="Permanently delete this surprise's photos and content?">
                  <input name="confirm" required placeholder='Type "DELETE"' className="rounded-xl border border-line px-3 py-2 text-sm" />
                </ActionForm>
              )}
            </div>
          </Card>

          <section>
            <h2 className="mb-3 font-display text-lg">Publish attempts</h2>
            <Table head={["Started", "Mode", "Source", "Status", "Error"]}>
              {ops.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 text-ink-soft">{fmt(o.started_at)}</td>
                  <td className="px-4 py-3">{o.mode}</td>
                  <td className="px-4 py-3">{o.source}</td>
                  <td className="px-4 py-3"><Badge value={o.status} /></td>
                  <td className="px-4 py-3 text-xs">{o.error_code}{o.error_message ? ` — ${o.error_message}` : ""}</td>
                </tr>
              ))}
            </Table>
          </section>

          {s.reports.length > 0 && (
            <Card>
              <h2 className="font-display text-lg">Reports</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {s.reports.map((r) => (
                  <li key={r.id}>
                    <span className="font-mono">{r.report_code}</span> <Badge value={r.status} /> · {fmt(r.created_at)}
                    {r.customer_message && <span className="block text-ink-soft">&ldquo;{r.customer_message}&rdquo;</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {cleanup && (
            <Card>
              <h2 className="font-display text-lg">Cleanup</h2>
              <p className="mt-2 text-sm">
                {cleanup.reason} · attempts {cleanup.attempts} · last {fmt(cleanup.last_attempt_at)} · next {fmt(cleanup.next_retry_at)}
              </p>
              {cleanup.last_error && <p className="mt-1 text-sm text-danger">{cleanup.last_error}</p>}
            </Card>
          )}

          {hasContent && template && (
            <Card>
              <h2 className="font-display text-lg">Customer content</h2>
              <dl className="mt-3 space-y-2 text-sm">
                {template.fields
                  .filter((f) => f.type !== "image")
                  .map((f) => {
                    const v = s.content[f.id] ?? s.style[f.id];
                    return v ? (
                      <div key={f.id}>
                        <dt className="text-xs text-ink-soft">{f.label}</dt>
                        <dd className="whitespace-pre-line">{v}</dd>
                      </div>
                    ) : null;
                  })}
              </dl>
            </Card>
          )}
        </div>

        {hasContent && template && isTemplateId(s.template_id) && (
          <aside className="xl:sticky xl:top-8 xl:self-start">
            <PhoneFrame height={640} label="Surprise as the recipient sees it">
              <TemplateExperience
                templateId={s.template_id}
                data={buildRenderData(template, { content: s.content, style: s.style }, urls)}
                mode="preview"
              />
            </PhoneFrame>
          </aside>
        )}
      </div>
    </>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
