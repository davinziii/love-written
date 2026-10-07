import {
  Caveat,
  Cormorant_Garamond,
  Dancing_Script,
  EB_Garamond,
  Fraunces,
  Great_Vibes,
  Inter,
  Libre_Baskerville,
  Lora,
  Nunito,
  Parisienne,
  Playfair_Display,
  Quicksand,
  Sacramento,
} from "next/font/google";

/**
 * Site fonts + the curated template fonts (see FONTS in src/templates/styles.ts).
 * Template fonts are not preloaded: browsers download a font file only when a page
 * actually uses it, so offering many choices doesn't slow normal pages down.
 */
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

// next/font needs literal options in each call (no shared spread objects).
// Story fonts
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-lora", style: ["normal", "italic"] });
const garamond = EB_Garamond({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-garamond", style: ["normal", "italic"] });
const baskerville = Libre_Baskerville({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-baskerville", weight: ["400", "700"], style: ["normal", "italic"] });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-cormorant", weight: ["400", "500", "600"], style: ["normal", "italic"] });
const nunito = Nunito({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-nunito", style: ["normal", "italic"] });
const quicksand = Quicksand({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-quicksand" });

// Final-message fonts
const greatVibes = Great_Vibes({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-greatvibes", weight: "400" });
const parisienne = Parisienne({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-parisienne", weight: "400" });
const sacramento = Sacramento({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-sacramento", weight: "400" });
const dancing = Dancing_Script({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-dancing" });
const caveat = Caveat({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-caveat" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-playfair", style: ["normal", "italic"] });

export const fontVariables = [
  inter,
  fraunces,
  lora,
  garamond,
  baskerville,
  cormorant,
  nunito,
  quicksand,
  greatVibes,
  parisienne,
  sacramento,
  dancing,
  caveat,
  playfair,
]
  .map((f) => f.variable)
  .join(" ");
