import "server-only";

/** The single price (centavos). ₱99 introductory = 9900. Charged amount is always read here on the server. */
export function priceCentavos(): number {
  const n = Number(process.env.PRICE_CENTAVOS ?? 9900);
  return Number.isInteger(n) && n > 0 ? n : 9900;
}
