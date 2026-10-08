/**
 * Flower set for "A Letter for You" (asset-driven: swap this array for a different set).
 * Tiny inline SVGs — no image requests — colored from the theme via CSS variables.
 */
import type { ReactElement } from "react";

export type FlowerArt = () => ReactElement;

const Rose: FlowerArt = () => (
  <svg viewBox="0 0 40 40" aria-hidden>
    <circle cx="20" cy="20" r="15" fill="var(--lfy-flower-a)" />
    <path d="M20 9c6 0 10 5 9 10-3-4-6-5-9-5s-6 1-9 5c-1-5 3-10 9-10z" fill="var(--lfy-flower-b)" opacity=".9" />
    <path d="M13 22c2 5 5 7 7 7s5-2 7-7c-3 2-5 3-7 3s-4-1-7-3z" fill="var(--lfy-flower-b)" opacity=".7" />
    <circle cx="20" cy="19" r="4.5" fill="var(--lfy-flower-b)" />
    <path d="M17 18c1.5-2 4.5-2 6 0" stroke="var(--lfy-flower-a)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
  </svg>
);

const Daisy: FlowerArt = () => (
  <svg viewBox="0 0 40 40" aria-hidden>
    {Array.from({ length: 10 }, (_, i) => (
      <ellipse key={i} cx="20" cy="9" rx="3.6" ry="8" fill="#fffdf8" stroke="var(--lfy-flower-b)" strokeOpacity=".25" transform={`rotate(${i * 36} 20 20)`} />
    ))}
    <circle cx="20" cy="20" r="5" fill="#f1b84b" />
  </svg>
);

const Tulip: FlowerArt = () => (
  <svg viewBox="0 0 40 40" aria-hidden>
    <path d="M20 38V22" stroke="#7c9c6f" strokeWidth="2" strokeLinecap="round" />
    <path d="M20 31c-5-1-8-4-9-8 4 0 7 2 9 5" fill="#8fb27f" />
    <path d="M11 8c2 5 4 8 9 9 5-1 7-4 9-9-3 2-5 4-6 4l-3-8-3 8c-1 0-3-2-6-4z" fill="var(--lfy-flower-a)" />
    <path d="M14 15c1 5 3 8 6 8s5-3 6-8c-2 2-4 3-6 3s-4-1-6-3z" fill="var(--lfy-flower-b)" />
  </svg>
);

const Blossom: FlowerArt = () => (
  <svg viewBox="0 0 40 40" aria-hidden>
    {Array.from({ length: 5 }, (_, i) => (
      <path key={i} d="M20 20C14 13 15 5 20 4c5 1 6 9 0 16z" fill="var(--lfy-flower-c)" transform={`rotate(${i * 72} 20 20)`} />
    ))}
    <circle cx="20" cy="20" r="3.5" fill="var(--lfy-flower-b)" />
  </svg>
);

const Petal: FlowerArt = () => (
  <svg viewBox="0 0 40 40" aria-hidden>
    <path d="M20 4c9 6 12 17 0 32C8 21 11 10 20 4z" fill="var(--lfy-flower-c)" />
    <path d="M20 8v24" stroke="var(--lfy-flower-b)" strokeOpacity=".35" strokeWidth="1" />
  </svg>
);

const Leaf: FlowerArt = () => (
  <svg viewBox="0 0 40 40" aria-hidden>
    <path d="M6 34C8 16 20 6 34 6c0 14-10 26-28 28z" fill="#9dbb8c" />
    <path d="M8 32C16 22 24 14 32 8" stroke="#7a9b6b" strokeWidth="1.3" fill="none" />
  </svg>
);

export const FLOWER_SET: FlowerArt[] = [Rose, Daisy, Tulip, Blossom, Petal, Leaf];

/**
 * Hand-tuned burst trajectories (not random each render, so it always looks composed).
 * x / peak / fall are in px from the envelope; rot in degrees; times in ms.
 */
export const BURST: { art: number; x: number; peak: number; fall: number; rot: number; size: number; dur: number; delay: number }[] = [
  { art: 0, x: -170, peak: 330, fall: 40, rot: -160, size: 44, dur: 2300, delay: 0 },
  { art: 2, x: 150, peak: 360, fall: 70, rot: 120, size: 46, dur: 2500, delay: 60 },
  { art: 1, x: -60, peak: 420, fall: 120, rot: 200, size: 36, dur: 2600, delay: 120 },
  { art: 3, x: 90, peak: 300, fall: 10, rot: -220, size: 34, dur: 2200, delay: 30 },
  { art: 4, x: -240, peak: 250, fall: -20, rot: 260, size: 26, dur: 2700, delay: 180 },
  { art: 5, x: 230, peak: 280, fall: 0, rot: -180, size: 30, dur: 2400, delay: 140 },
  { art: 0, x: 30, peak: 460, fall: 160, rot: 140, size: 38, dur: 2800, delay: 220 },
  { art: 4, x: -120, peak: 380, fall: 90, rot: -300, size: 22, dur: 2900, delay: 260 },
  { art: 1, x: 200, peak: 410, fall: 130, rot: 240, size: 30, dur: 2700, delay: 200 },
  { art: 3, x: -200, peak: 440, fall: 150, rot: 180, size: 28, dur: 3000, delay: 300 },
  { art: 5, x: 120, peak: 220, fall: -40, rot: 90, size: 24, dur: 2300, delay: 340 },
  { art: 2, x: -20, peak: 300, fall: 30, rot: -120, size: 32, dur: 2400, delay: 380 },
];
