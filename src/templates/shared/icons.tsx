/** Small inline icons shared by renderers (no icon library needed). */

export function HeartIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4.7-1.2 2.1-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export function MusicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 18.5a2.5 2.5 0 1 1-2-2.45V5.5l12-2.5v12a2.5 2.5 0 1 1-2-2.45V7.1l-8 1.7z" />
    </svg>
  );
}

export function MutedIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 18V6l10-2v10" />
      <circle cx="6.5" cy="18" r="2.5" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
