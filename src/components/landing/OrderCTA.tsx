"use client";

import Link from "next/link";
import { HeartBurst } from "@/components/motion/Motion";
import { Icon } from "@/components/ui/icons";
import { ORDER_CONTACT, isManualPayments } from "@/lib/payments/mode";
import { trackClient } from "@/lib/client/analytics";
import type { ClientEvent } from "@/lib/analytics/events";
import { ctaClasses } from "./cta-classes";

const { primary, secondary } = ctaClasses;

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

