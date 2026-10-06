"use client";

import Link from "next/link";
import { HeartBurst } from "@/components/motion/Motion";
import { Icon } from "@/components/ui/icons";
import { ORDER_CONTACT, isManualPayments } from "@/lib/payments/mode";
import { trackClient } from "@/lib/client/analytics";
import type { ClientEvent } from "@/lib/analytics/events";

const primary =
  "lw-press inline-flex items-center justify-center gap-2 rounded-full bg-rose px-7 py-4 text-base font-medium text-white shadow-[0_16px_30px_-12px_rgba(196,72,106,0.75)] hover:bg-rose-deep hover:shadow-[0_20px_36px_-12px_rgba(196,72,106,0.85)]";
const secondary =
  "lw-press inline-flex items-center justify-center gap-2 rounded-full bg-white/80 px-6 py-4 text-base font-medium text-ink shadow-sm ring-1 ring-line backdrop-blur hover:ring-ink/30";

/** The main emotional CTA: "Pick a Surprise" with a small heart burst. */
export function PickSurpriseCTA({ label = "Pick a Surprise", event = "pick_surprise_click" as ClientEvent }) {
  return (
    <HeartBurst>
      <Link href="/surprises" className={primary} onClick={() => trackClient(event)}>
        {label} <Icon.arrowRight size={18} />
      </Link>
    </HeartBurst>
  );
}

/**
 * Manual launch workflow: ordering happens in DMs. Renders the configured contact link
 * (NEXT_PUBLIC_ORDER_URL), or a calm "opening soon" state if it isn't set yet.
 */
export function MessageToOrderCTA({ templateName, variant = "primary" }: { templateName?: string; variant?: "primary" | "secondary" }) {
  if (!isManualPayments) return null;
  if (!ORDER_CONTACT.url) {
    return (
      <span className={`${variant === "primary" ? primary : secondary} pointer-events-none opacity-60`} aria-disabled>
        <Icon.message size={18} /> Ordering opens soon
      </span>
    );
  }
  return (
    <HeartBurst>
      <a
        href={ORDER_CONTACT.url}
        target="_blank"
        rel="noopener noreferrer"
        className={variant === "primary" ? primary : secondary}
        onClick={() => trackClient("checkout_clicked")}
        aria-label={templateName ? `${ORDER_CONTACT.label} — ${templateName}` : ORDER_CONTACT.label}
      >
        <Icon.message size={18} /> {ORDER_CONTACT.label}
      </a>
    </HeartBurst>
  );
}

export const ctaClasses = { primary, secondary };
