"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

/** Shown instead of a blank crash if an admin page fails on the server. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="font-display text-3xl">This admin page couldn&rsquo;t load</h1>
      <p className="mt-3 text-ink-soft">
        Something failed on the server. On Vercel, open your project → <strong>Logs</strong> and look for errors around this
        time{error.digest ? " — search for the code below" : ""}.
      </p>
      {error.digest && <p className="mt-4 inline-block rounded-full bg-soft px-4 py-1.5 font-mono text-xs">{error.digest}</p>}
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/admin/settings" className="inline-flex items-center rounded-full px-5 py-3 text-sm ring-1 ring-line">
          Settings
        </Link>
      </div>
    </div>
  );
}
