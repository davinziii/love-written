import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin/auth";
import { Card, PageTitle } from "@/components/admin/ui";
import { ManualBoothForm } from "@/components/admin/ManualBoothForm";
import { Icon } from "@/components/ui/icons";
import { photoboothPriceCentavos } from "@/lib/photobooth/price";

const STEPS = [
  { icon: Icon.wallet, text: "Confirm the payment in your GCash / Maya / bank app." },
  { icon: Icon.image, text: "Create the photobooth here — it is marked as paid." },
  { icon: Icon.send, text: "DM the buyer their private link (Person A)." },
  { icon: Icon.link, text: "They check their camera and send their person the invite link they see." },
];

export default async function NewPhotoboothPage() {
  await requireAdmin();
  const idempotencyKey = randomUUID(); // one per page load: a double submit creates one photobooth

  return (
    <>
      <PageTitle title="Create Photobooth" subtitle="Record a payment you received and send the buyer their private photobooth link." />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card tone="white">
          <ManualBoothForm defaultAmountPesos={photoboothPriceCentavos() / 100} idempotencyKey={idempotencyKey} />
        </Card>
        <Card>
          <h2 className="font-semibold">How it works</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.text} className="flex gap-3 text-sm">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-rose shadow-sm">
                  <s.icon size={16} />
                </span>
                <span className="pt-1.5">
                  <span className="text-ink-soft">{i + 1}.</span> {s.text}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs leading-relaxed text-ink-soft">
            The 7-day photo retention starts only when they finish their four photos. Camera problems never use up the session.
          </p>
        </Card>
      </div>
    </>
  );
}
