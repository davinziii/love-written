"use client";

import { useLinkStatus } from "next/link";

/**
 * Put inside a <Link>: shows a small spinner while that link's page is loading, so a click
 * never feels "stuck". (Must be rendered as a descendant of next/link.)
 */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-current border-r-transparent ${className}`}
      style={{ animation: "lw-spin 0.7s linear infinite" }}
    />
  );
}
