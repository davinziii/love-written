"use client";

import { useEffect, useState } from "react";

/** Calm full-screen message for every "not viewable right now" state. */
export function ViewerMessage({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <main className="grid min-h-svh place-items-center bg-[radial-gradient(60%_50%_at_50%_40%,#f6d5dc,transparent_75%)] px-6 text-center">
      <div className="max-w-md">
        <svg width="48" height="48" viewBox="0 0 24 24" className="mx-auto text-rose" fill="currentColor" aria-hidden>
          <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.3 2.4.7-1.2 2.1-2.4 4.3-2.4 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" />
        </svg>
        <h1 className="mt-6 font-display text-4xl tracking-tight">{title}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">{body}</p>
        {children}
        <p className="mt-12 text-xs text-ink-soft">Love, Written</p>
      </div>
    </main>
  );
}

/** Scheduled but not yet revealed: a gentle countdown, then reload at the reveal time. */
export function NotYet({ revealAt }: { revealAt: string }) {
  const target = new Date(revealAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= target) {
        clearInterval(id);
        setTimeout(() => window.location.reload(), 1500);
      }
    }, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [target]);

  const remaining = now === null ? null : Math.max(0, target - now);
  const parts =
    remaining === null
      ? null
      : [
          { n: Math.floor(remaining / 86_400_000), l: "days" },
          { n: Math.floor((remaining / 3_600_000) % 24), l: "hours" },
          { n: Math.floor((remaining / 60_000) % 60), l: "minutes" },
          { n: Math.floor((remaining / 1000) % 60), l: "seconds" },
        ];

  return (
    <ViewerMessage title="Something special is on its way" body="This surprise isn't ready to be opened yet. Come back when the time comes.">
      {parts && (
        <div className="mt-8 flex justify-center gap-3" aria-live="off">
          {parts.map((p) => (
            <div key={p.l} className="w-18 rounded-2xl bg-paper px-3 py-3 ring-1 ring-line">
              <div className="font-display text-3xl tabular-nums">{p.n}</div>
              <div className="text-xs text-ink-soft">{p.l}</div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-sm text-ink-soft">
        Opens {new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(revealAt))}
      </p>
    </ViewerMessage>
  );
}
