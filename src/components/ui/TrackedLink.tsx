"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import type { ClientEvent } from "@/lib/analytics/events";
import { trackClient } from "@/lib/client/analytics";

export function TrackedLink({
  event,
  templateId,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { event: ClientEvent; templateId?: string }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        trackClient(event, templateId);
        onClick?.(e);
      }}
    />
  );
}
