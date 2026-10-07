/**
 * Shown instantly while an admin page loads (inside the sidebar/header, which stay put).
 * A calm skeleton of the usual layout: title, stat cards, a list.
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div className="space-y-3">
          <div className="h-9 w-56 rounded-2xl bg-soft" />
          <div className="h-4 w-80 max-w-full rounded-full bg-soft" />
        </div>
        <div className="hidden h-10 w-40 rounded-full bg-soft sm:block" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-36 rounded-3xl bg-soft" />
        ))}
      </div>
      <div className="mt-6 space-y-3 rounded-3xl bg-soft p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-14 rounded-2xl bg-white/80" />
        ))}
      </div>
    </div>
  );
}
