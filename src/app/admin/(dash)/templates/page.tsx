import { requireAdmin } from "@/lib/admin/auth";
import { templateUsage } from "@/lib/admin/queries";
import { Badge, Card, PageTitle } from "@/components/admin/ui";
import { TEMPLATES } from "@/templates";
import { RENDERERS, TemplateExperience } from "@/templates/renderers";
import { PHONE_WIDTH } from "@/components/preview/PhoneFrame";
import { ScaledViewport } from "@/components/preview/ScaledViewport";
import { isTemplateId } from "@/templates";
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
            <div className="flex gap-5">
            {/* A small live preview with sample content, so templates are easy to tell apart. */}
            {isTemplateId(t.id) && t.id in RENDERERS && (
              <div className="w-[128px] shrink-0 self-start overflow-hidden rounded-2xl bg-paper ring-4 ring-ink">
                <ScaledViewport virtualWidth={PHONE_WIDTH} height={240} initialScale={0.34} label={`${t.name} preview`} interactive={false} hideScrollbar>
                  <TemplateExperience templateId={t.id} data={t.sample} mode="preview" />
                </ScaledViewport>
              </div>
            )}
            <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
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
            </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
