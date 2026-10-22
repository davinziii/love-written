import { describe, expect, it } from "vitest";
import { listedTemplates } from "@/templates";
import { startingPriceCentavos, templatePriceCentavos } from "@/lib/price";
import { centavosToRupees, currencyForTimeZone, formatRupees } from "@/lib/currency";
import { MANUAL_PAYMENT_CHANNELS, PAYMENT_CHANNEL_LABELS } from "@/lib/payments/channels";

describe("template prices", () => {
  it("each template has its own price, and the catalog lists them in this order", () => {
    expect(listedTemplates().map((t) => [t.id, t.priceCentavos])).toEqual([
      ["our-story", 9900],
      ["letter-for-you", 9900],
      ["cd-collection", 9900],
      ["journal", 9900],
      ["pieces-of-us", 14900],
      ["loveflix", 19900],
      ["pixel-heart-hunt", 19900],
    ]);
  });

  it("checkout reads the template's price on the server; unknown templates fail", () => {
    expect(templatePriceCentavos("loveflix")).toBe(19900);
    expect(templatePriceCentavos("pieces-of-us")).toBe(14900);
    expect(() => templatePriceCentavos("nope")).toThrow();
    expect(startingPriceCentavos()).toBe(9900);
  });
});

describe("rupees for visitors in India", () => {
  it("converts at the fixed rate to whole rupees", () => {
    expect(centavosToRupees(9900)).toBe(149);
    expect(centavosToRupees(14900)).toBe(224);
    expect(centavosToRupees(19900)).toBe(299);
    expect(centavosToRupees(9900, 1.6)).toBe(158);
    expect(formatRupees(1499)).toBe("₹1,499");
  });

  it("only India's time zones see rupees", () => {
    expect(currencyForTimeZone("Asia/Kolkata")).toBe("INR");
    expect(currencyForTimeZone("Asia/Calcutta")).toBe("INR");
    expect(currencyForTimeZone("Asia/Manila")).toBe("PHP");
    expect(currencyForTimeZone(undefined)).toBe("PHP");
  });
});

describe("manual payment channels", () => {
  it("include PayPal, each with a label", () => {
    expect(MANUAL_PAYMENT_CHANNELS).toContain("paypal");
    for (const c of MANUAL_PAYMENT_CHANNELS) expect(PAYMENT_CHANNEL_LABELS[c]).toBeTruthy();
    expect(PAYMENT_CHANNEL_LABELS.paypal).toBe("PayPal");
  });
});
