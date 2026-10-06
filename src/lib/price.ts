import "server-only";

/** The single price (centavos). ₱199 introductory = 19900. Charged amount is always read here on the server. */
export function priceCentavos(): number {
  const n = Number(process.env.PRICE_CENTAVOS ?? 19900);
  return Number.isInteger(n) && n > 0 ? n : 19900;
}
