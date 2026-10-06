import { Cormorant_Garamond, Dancing_Script, Fraunces, Inter, Lora, Playfair_Display } from "next/font/google";

/**
 * Site fonts + the curated template fonts (see FONTS in src/templates/styles.ts).
 * Template-only fonts are not preloaded; browsers download them only when used.
 */
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", preload: false });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
  preload: false,
});
const dancing = Dancing_Script({ subsets: ["latin"], variable: "--font-dancing", display: "swap", preload: false });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap", preload: false });

export const fontVariables = [inter, fraunces, playfair, cormorant, dancing, lora].map((f) => f.variable).join(" ");
