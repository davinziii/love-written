import "server-only";

/**
 * ₱50 by default (PHOTOBOOTH_PRICE_CENTAVOS). A solo photobooth uses
 * PHOTOBOOTH_SOLO_PRICE_CENTAVOS when it's set, otherwise the same price.
 * Server-side only — never taken from the browser.
 */
export function photoboothPriceCentavos(partySize: 1 | 2 = 2): number {
  const base = parse(process.env.PHOTOBOOTH_PRICE_CENTAVOS) ?? 5000;
  return partySize === 1 ? (parse(process.env.PHOTOBOOTH_SOLO_PRICE_CENTAVOS) ?? base) : base;
}

function parse(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
