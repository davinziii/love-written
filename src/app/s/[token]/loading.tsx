/** Shown while a surprise loads — a soft beating heart instead of a blank screen. */
export default function SurpriseLoading() {
  return (
    <main role="status" aria-label="Opening your surprise" className="grid min-h-svh place-items-center bg-cream">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="lw-bob text-rose" style={{ ["--t" as string]: "1.4s" }}>
        <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4.7-1.2 2.1-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" />
      </svg>
      <span className="sr-only">Opening your surprise…</span>
    </main>
  );
}
