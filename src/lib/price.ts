import { getTemplate, listedTemplates } from "@/templates";

/**
 * Template prices (centavos). Each template sets its own price in its definition; the amount
 * charged at checkout is always read here on the server, never from the browser.
 */
export function templatePriceCentavos(templateId: string): number {
  const t = getTemplate(templateId);
  if (!t) throw new Error(`Unknown template "${templateId}"`);
  return t.priceCentavos;
}

/** The cheapest listed template ("from ₱99"). */
export function startingPriceCentavos(): number {
  return Math.min(...listedTemplates().map((t) => t.priceCentavos));
}
