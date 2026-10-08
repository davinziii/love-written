import "server-only";

/** ₱50 by default (PHOTOBOOTH_PRICE_CENTAVOS). Server-side only — never taken from the browser. */
export function photoboothPriceCentavos(): number {
  const n = Number(process.env.PHOTOBOOTH_PRICE_CENTAVOS ?? 5000);
  return Number.isInteger(n) && n > 0 ? n : 5000;
}
