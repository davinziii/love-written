/**
 * Showing prices in the visitor's currency. Prices are set (and charged) in pesos; visitors
 * in India see them converted to rupees at a fixed rate.
 *
 * The rate is a setting (NEXT_PUBLIC_PHP_TO_INR), not a live exchange rate, so a price never
 * changes between looking and paying. 1.5 turns ₱99 / ₱149 / ₱199 into ₹149 / ₹224 / ₹299.
 */
export const PHP_TO_INR = (() => {
  const n = Number(process.env.NEXT_PUBLIC_PHP_TO_INR);
  return Number.isFinite(n) && n > 0 ? n : 1.5;
})();

export type DisplayCurrency = "PHP" | "INR";

/** Whole rupees for a peso price in centavos. */
export function centavosToRupees(centavos: number, rate = PHP_TO_INR): number {
  return Math.round((centavos / 100) * rate);
}

export function formatRupees(rupees: number): string {
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/**
 * India time zones → rupees. A time zone needs no network request or location permission, and
 * pages stay cached for everyone (the price switches in the browser). Pesos everywhere else.
 */
export function currencyForTimeZone(timeZone: string | undefined): DisplayCurrency {
  return timeZone === "Asia/Kolkata" || timeZone === "Asia/Calcutta" ? "INR" : "PHP";
}
