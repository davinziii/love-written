import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { Card, PageTitle } from "@/components/admin/ui";
import { Icon } from "@/components/ui/icons";

const GUIDES = [
  {
    icon: Icon.wallet,
    title: "A customer paid",
    steps: [
      "Check the payment in your GCash / Maya / bank app.",
      "Go to Create Surprise, pick the template, enter the amount and reference.",
      "Copy the ready-made message and send it in the customer's DM.",
    ],
    href: "/admin/orders/new",
    cta: "Create Surprise",
  },
  {
    icon: Icon.link,
    title: "A customer lost their link",
    steps: [
      "Ask them to use “Find my surprise” with their recovery code first.",
      "If they lost the code too, search their order, open it, and click “New customer link”.",
      "The old link and code stop working immediately.",
    ],
    href: "/admin/search",
    cta: "Search orders",
  },
  {
    icon: Icon.alert,
    title: "Publishing failed",
    steps: [
      "The customer sees “Do not pay again” and can retry or report it.",
      "Open Failed Publish, read the reason, then Retry Publish. It never charges again.",
      "Mark the related report resolved afterwards.",
    ],
    href: "/admin/failed-publish",
    cta: "Failed Publish",
  },
  {
    icon: Icon.trash,
    title: "Deletion failed",
    steps: [
      "Expired surprises are deleted automatically and the deletion is double-checked.",
      "After 3 failed automatic retries they appear under Cleanup.",
      "Retry there once the cause (usually a storage hiccup) is fixed.",
    ],
    href: "/admin/cleanup",
    cta: "Cleanup",
  },
];

export default async function HelpPage() {
  await requireAdmin();
  return (
    <>
      <PageTitle title="Help" subtitle="Quick guides for running Love, Written day to day." />
      <div className="grid gap-5 md:grid-cols-2">
        {GUIDES.map((g) => (
          <Card key={g.title} className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-rose shadow-sm">
                <g.icon size={19} />
              </span>
              <h2 className="font-semibold">{g.title}</h2>
            </div>
            <ol className="mt-4 flex-1 list-inside list-decimal space-y-2 text-sm text-ink-soft">
              {g.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <Link href={g.href} className="mt-5 inline-flex items-center gap-1.5 self-start rounded-full bg-white px-4 py-2 text-sm font-medium ring-1 ring-black/[0.06] hover:text-rose">
              {g.cta} <Icon.arrowRight size={14} />
            </Link>
          </Card>
        ))}
      </div>
      <Card className="mt-5">
        <h2 className="font-semibold">Product rules to remember</h2>
        <ul className="mt-3 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
          <li>• Published surprises can never be edited.</li>
          <li>• Scheduled surprises stay editable until the reveal time.</li>
          <li>• Surprises stay online for 30 days after going live.</li>
          <li>• Successful payments are non-refundable; failed publishing is always retried for free.</li>
        </ul>
        <p className="mt-4 text-xs text-ink-soft">Developer docs: README.md, TEMPLATE_DEVELOPMENT.md and the docs/ folder in the project.</p>
      </Card>
    </>
  );
}
