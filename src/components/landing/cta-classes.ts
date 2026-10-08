/**
 * Call-to-action button styles. Kept in a plain (non-"use client") module so server
 * components can use them — values imported from a client module arrive empty on the server.
 */
export const ctaClasses = {
  primary:
    "lw-press inline-flex items-center justify-center gap-2 rounded-full bg-rose px-7 py-4 text-base font-medium text-white shadow-[0_16px_30px_-12px_rgba(196,72,106,0.75)] hover:bg-rose-deep hover:shadow-[0_20px_36px_-12px_rgba(196,72,106,0.85)]",
  secondary:
    "lw-press inline-flex items-center justify-center gap-2 rounded-full bg-white/80 px-6 py-4 text-base font-medium text-ink shadow-sm ring-1 ring-line backdrop-blur hover:ring-ink/30",
};
