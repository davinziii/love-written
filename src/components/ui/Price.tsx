"use client";

import { useSyncExternalStore } from "react";
import { formatPeso } from "@/lib/format";
import { centavosToRupees, currencyForTimeZone, formatRupees, type DisplayCurrency } from "@/lib/currency";

const noSubscribe = () => () => {};
const visitorCurrency = (): DisplayCurrency => {
  try {
    return currencyForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return "PHP";
  }
};

/** Which currency this visitor sees: pesos on the server (and by default), rupees in India. */
export function useDisplayCurrency(): DisplayCurrency {
  return useSyncExternalStore(noSubscribe, visitorCurrency, () => "PHP");
}

/** A template price in the visitor's currency: ₱99, or ₹149 for visitors in India. */
export function Price({ centavos, className }: { centavos: number; className?: string }) {
  const currency = useDisplayCurrency();
  return <span className={className}>{currency === "INR" ? formatRupees(centavosToRupees(centavos)) : formatPeso(centavos)}</span>;
}
