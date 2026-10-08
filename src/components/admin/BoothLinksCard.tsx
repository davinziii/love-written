"use client";

import { Icon } from "@/components/ui/icons";
import { CopyRow } from "./IssuedAccessCard";

/**
 * Both private photobooth links + a ready-to-paste message for the buyer (Person A).
 * Person A's own screen also shows Person B's invite link, so sending A's link is enough.
 */
export function BoothLinksCard({ linkA, linkB, orderNumber, fresh = false }: { linkA: string; linkB: string | null; orderNumber?: string; fresh?: boolean }) {
  const message = [
    "Hi! 📸 Your Love, Written Photobooth is ready.",
    "",
    "Your private photobooth link:",
    linkA,
    "",
    "Open it, check your camera, then send your person the invite link you'll see there (they join free).",
    "",
    "📱 For best results, tap ⋯ → Open in browser (Chrome or Safari).",
    "🗓️ Your photos are kept for 7 days after you finish — download them before then.",
  ].join("\n");

  return (
    <div className="rounded-3xl bg-[linear-gradient(135deg,#fbe9ec,#fffdfa)] p-5 ring-1 ring-blush sm:p-6">
      <p className="flex items-center gap-2 font-medium">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-success text-white">
          <Icon.check size={15} strokeWidth={3} />
        </span>
        {fresh ? "Photobooth ready" : "Private photobooth links"}
        {orderNumber ? ` · ${orderNumber}` : ""}
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        These links are the participants&rsquo; keys — send Person A&rsquo;s only to the buyer. Anyone with a link can join as that person.
      </p>
      <div className="mt-5 space-y-3">
        <CopyRow label="Person A (buyer) link" value={linkA} mono />
        {linkB && <CopyRow label="Person B (invite) link — A also sees this on their screen" value={linkB} mono />}
        <CopyRow label="Message for the buyer" value={message} multiline />
      </div>
    </div>
  );
}
