import { requireAdmin } from "@/lib/admin/auth";
import { templateUsage } from "@/lib/admin/queries";
import { Badge, Card, PageTitle } from "@/components/admin/ui";
import { TEMPLATES } from "@/templates";
import { RENDERERS } from "@/templates/renderers";
import type { TemplateDefinition } from "@/templates/types";

/** Templates are trusted code (see TEMPLATE_DEVELOPMENT.md). This page is read-only. */
export default async function TemplatesPage() {
  await requireAdmin();
  const usage = await templateUsage();
  const templates = Object.values(TEMPLATES as Record<string, TemplateDefinition>);
  return (
    <>
      <PageTitle title="Templates" subtitle="Defined in src/templates. To add or hide one, change code and deploy." />
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl">{t.name}</h2>
                <p className="font-mono text-xs text-ink-soft">{t.id} · schema v{t.schemaVersion}</p>
              </div>
              <Badge value={t.listed ? "LISTED" : "HIDDEN"} />
            </div>
            <p className="mt-3 text-sm text-ink-soft">{t.tagline}</p>
            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-xs text-ink-soft">Fields</dt><dd>{t.fields.length}</dd></div>
              <div><dt className="text-xs text-ink-soft">Renderer</dt><dd>{t.id in RENDERERS ? "registered" : "missing"}</dd></div>
              <div><dt className="text-xs text-ink-soft">Surprises</dt><dd>{usage[t.id] ?? 0}</dd></div>
            </dl>
          </Card>
        ))}
      </div>
    </>
  );
}
