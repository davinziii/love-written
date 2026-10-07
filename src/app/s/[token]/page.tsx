import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/supabase/admin";
import { log, errorMessage } from "@/lib/log";
import { track } from "@/lib/analytics/server";
import { viewerAccess } from "@/lib/lifecycle";
import { PUBLIC_TOKEN_PATTERN } from "@/lib/security/tokens";
import { ipKey } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { customerData, getMedia, getSurprise, getSurpriseByPublicToken, mediaUrlsByField } from "@/lib/surprises/repo";
import { activateScheduled, expireSurprise } from "@/lib/surprises/lifecycle-jobs";
import { getTemplate, isTemplateId } from "@/templates";
import { buildRenderData } from "@/templates/render-data";
import { TemplateExperience } from "@/templates/renderers";
import { NotYet, ViewerMessage } from "@/components/viewer/ViewerStates";
import { ReportSurprise } from "@/components/viewer/ReportSurprise";
import { getTheme } from "@/templates/styles";

// Generic metadata only: link previews in chat apps must not reveal names or photos.
export const metadata: Metadata = {
  title: "A surprise for you 💌",
  description: "Someone made something special for you.",
  robots: { index: false, follow: false, noarchive: true, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

/**
 * The recipient's page. One route serves every surprise: token → server lookup →
 * lifecycle access check → trusted renderer. Access is decided here, never in the renderer.
 */
export default async function SurprisePage({ params }: Props) {
  await connection();
  const { token } = await params;
  if (!PUBLIC_TOKEN_PATTERN.test(token)) notFound(); // cheap rejection, no DB hit

  if (!(await checkRateLimit("view", ipKey(await headers()), { failOpen: true }))) {
    return <ViewerMessage title="Just a moment" body="Too many requests from your connection. Please wait a minute and refresh." />;
  }

  let row = await getSurpriseByPublicToken(token);
  if (!row) notFound();
  let access = viewerAccess(row);

  if (access.kind === "activate") {
    try {
      await activateScheduled(row);
    } catch (err) {
      log.warn("lazy_activation_failed", { surpriseId: row.id, error: errorMessage(err) });
    }
    row = (await getSurprise(row.id)) ?? row;
    access = viewerAccess(row);
  }

  switch (access.kind) {
    case "not_yet":
      return <NotYet revealAt={access.revealAt} />;
    case "activate":
    case "preparing":
      return (
        <ViewerMessage
          title="Almost ready"
          body="This surprise is being prepared. Please check back in a little while."
        />
      );
    case "ended":
      if (row.stage === "PUBLISHED") await expireSurprise(row.id).catch(() => undefined);
      return (
        <ViewerMessage
          title="This surprise has ended"
          body="Love, Written surprises stay online for 30 days, then their photos and messages are deleted to keep them private."
        >
          <Link href="/" className="mt-8 inline-flex rounded-full bg-rose px-6 py-3 font-medium text-white hover:bg-rose-deep">
            Make a surprise for someone →
          </Link>
        </ViewerMessage>
      );
    case "unavailable":
      return <ViewerMessage title="This surprise is unavailable" body="It has been taken offline." />;
    case "not_found":
      notFound();
    case "live":
      break;
  }

  const template = getTemplate(row.template_id);
  if (!template || !isTemplateId(row.template_id)) notFound();

  const media = await getMedia(row.id);
  const data = buildRenderData(template, customerData(row), await mediaUrlsByField(media));
  // Shared style convention: themes live in style.theme for every template.
  const theme = getTheme(row.style?.theme);

  // Count opens (no per-viewer data). The funnel event is recorded on the first open only.
  const { data: firstOpen, error } = await db().rpc("record_surprise_open", { p_id: row.id });
  if (error) log.warn("record_open_failed", { surpriseId: row.id, error: error.message });
  else if (firstOpen === true) await track("recipient_opened", { templateId: row.template_id, surpriseId: row.id });

  return (
    <div
      style={{ "--lw-screen-h": "100svh", "--lw-bg": theme.bg, "--lw-muted": theme.muted, background: theme.bg } as CSSProperties}
    >
      <TemplateExperience templateId={row.template_id} data={data} mode="live" />
      <ReportSurprise token={token} />
    </div>
  );
}
