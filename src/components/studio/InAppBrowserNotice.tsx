"use client";

import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icons";
import { inAppBrowserName } from "@/lib/client/in-app-browser";
import { getLocalDraft } from "@/lib/client/drafts";

const DISMISS_KEY = "lw-in-app-notice-dismissed";
const noSubscribe = () => () => {};

/**
 * Shown when the studio is opened inside Messenger/Facebook/Instagram's built-in browser:
 * suggests Chrome or Safari, and copies the full private link (with its access code) so
 * it works there too.
 */
export function InAppBrowserNotice({ surpriseId }: { surpriseId: string }) {
  const app = useSyncExternalStore(
    noSubscribe,
    () => inAppBrowserName(navigator.userAgent),
    () => null,
  );
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [copied, setCopied] = useState(false);
  if (!app || dismissed) return null;

  function privateLink(): string {
    const draft = getLocalDraft(surpriseId);
    if (!draft?.editToken) return window.location.href;
    const fragment = new URLSearchParams({ access: draft.editToken, ...(draft.recoveryCode ? { code: draft.recoveryCode } : {}) });
    return `${window.location.origin}/studio/${surpriseId}#${fragment.toString()}`;
  }

  async function copy() {
    const link = privateLink();
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Older in-app browsers: fall back to a temporary text field.
      const field = document.createElement("textarea");
      field.value = link;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  function dismiss() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // private mode — it simply comes back next visit
    }
  }

  return (
    <div role="status" className="mb-6 rounded-3xl bg-[linear-gradient(135deg,#fff4e5,#fffdfa)] p-4 ring-1 ring-[#f2d3a8] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-lg shadow-sm ring-1 ring-[#f2d3a8]" aria-hidden>
          📱
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">You&rsquo;re in {app}&rsquo;s built-in browser</p>
          <p className="mt-1 text-sm text-ink-soft">
            Photo uploads can get interrupted here. For the smoothest experience, tap <strong>⋯</strong> →{" "}
            <strong>Open in browser</strong>, or copy your private link and paste it into Chrome or Safari.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="lw-press inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream hover:bg-rose"
            >
              {copied ? <Icon.check size={15} /> : <Icon.copy size={15} />}
              {copied ? "Link copied" : "Copy my private link"}
            </button>
            <button type="button" onClick={dismiss} className="rounded-full px-3 py-2 text-sm text-ink-soft hover:text-ink">
              Continue here
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">Keep this link to yourself — anyone with it can edit your surprise.</p>
        </div>
      </div>
    </div>
  );
}
