"use client";

import { useEffect } from "react";
import type { ClientEvent } from "@/lib/analytics/events";
import { trackClient } from "@/lib/client/analytics";

/** Records a page-view style funnel event once per mount. */
export function TrackView({ event, templateId }: { event: ClientEvent; templateId?: string }) {
  useEffect(() => trackClient(event, templateId), [event, templateId]);
  return null;
}
