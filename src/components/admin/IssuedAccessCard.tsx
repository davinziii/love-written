"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icons";
import type { IssuedAccess } from "@/lib/payments/manual";

/**
 * Shows a freshly issued private link + recovery code ONCE (they're stored hashed, so
 * they can't be shown again), with a ready-to-paste message for the customer's DM.
 */
export function IssuedAccessCard({ access }: { access: IssuedAccess }) {
  if (!access.customizationLink || !access.recoveryCode) return null;
  const message = [
    "Hi! 💌 Your Love, Written order is confirmed.",
    "",
    "Here's your private link to create your surprise:",
    access.customizationLink,
    "",
    `Your recovery code (keep it safe): ${access.recoveryCode}`,
    "",
    "📱 For best results, tap ⋯ → Open in browser.",
    "🤫 Don't forward this message to them.",
    "",
    "You can edit until you publish — once it's live it's locked, and it stays online for 30 days. If you don't open your link for 60 days before publishing, the surprise is deleted.",
  ].join("\n");

  return (
    <div className="lw-pop rounded-3xl bg-[linear-gradient(135deg,#fbe9ec,#fffdfa)] p-5 ring-1 ring-blush sm:p-6">
      <p className="flex items-center gap-2 font-medium">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-success text-white">
          <Icon.check size={15} strokeWidth={3} />
        </span>
        Private link ready{access.orderNumber ? ` · ${access.orderNumber}` : ""}
      </p>
      <p className="mt-2 text-sm text-ink-soft">
        Copy it now — for security we don&rsquo;t keep it in readable form, so it <strong>can&rsquo;t be shown again</strong>. If it&rsquo;s lost,
        issue a new one from the surprise&rsquo;s page.
      </p>
      <div className="mt-5 space-y-3">
        <CopyRow label="Customization link" value={access.customizationLink} mono />
        <CopyRow label="Recovery code" value={access.recoveryCode} mono />
        <CopyRow label="Message for the customer" value={message} multiline />
      </div>
    </div>
  );
}

function CopyRow({ label, value, mono, multiline }: { label: string; value: string; mono?: boolean; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-black/[0.05]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        <button
          type="button"
          className="lw-press inline-flex items-center gap-1.5 rounded-full bg-soft px-3 py-1 text-xs font-medium hover:bg-petal hover:text-rose"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              // select the text manually
            }
          }}
        >
          {copied ? <Icon.check size={13} /> : <Icon.copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {multiline ? (
        <textarea readOnly rows={8} value={value} className="mt-2 w-full resize-none rounded-xl bg-soft p-3 text-sm" onFocus={(e) => e.currentTarget.select()} />
      ) : (
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={`mt-2 w-full rounded-xl bg-soft px-3 py-2 text-sm ${mono ? "font-mono" : ""}`}
        />
      )}
    </div>
  );
}
