"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, HeartIcon } from "@/components/ui/icons";
import { copyText } from "@/lib/photobooth/client";
import { PHOTOBOOTH_ROUNDS } from "@/lib/photobooth/constants";
import type { BoothPersonState, CameraIssue } from "@/lib/photobooth/types";
import { ORDER_CONTACT } from "@/lib/payments/mode";
import type { Camera } from "./useCamera";
import type { LiveStatus } from "./useLiveVideo";
import s from "./photobooth.module.css";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.75rem] bg-paper p-5 ring-1 ring-line sm:p-6 ${className}`}>{children}</section>;
}

export function CameraView({ camera, children, dim = false }: { camera: Camera; children?: ReactNode; dim?: boolean }) {
  return <CameraFrame attach={camera.attach} status={camera.status} dim={dim}>{children}</CameraFrame>;
}

function CameraFrame({ attach, status, children, dim }: { attach: Camera["attach"]; status: Camera["status"]; children?: ReactNode; dim: boolean }) {
  return (
    <div className={s.camera}>
      <video ref={attach} className={s.video} playsInline muted autoPlay aria-label="Your camera" />
      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
          {status === "starting" ? "Starting your camera…" : "Camera is off"}
        </div>
      )}
      {dim && <div className="absolute inset-0 bg-black/30" />}
      {children}
    </div>
  );
}

/**
 * You and your person side by side — always Person A on the left and Person B on the right,
 * exactly like each slot of the final strip, so poses line up the way they'll print.
 * Both are shown mirrored (as each of you sees yourself), which is also how photos are saved.
 */
export function SplitView({
  camera,
  role,
  live,
  partnerName = "Your person",
  children,
}: {
  camera: Camera;
  role: "A" | "B";
  live: { status: LiveStatus; remote: MediaStream | null };
  partnerName?: string;
  children?: ReactNode;
}) {
  const mine = <SelfTile key="me" attach={camera.attach} status={camera.status} />;
  const theirs = <PartnerTile key="them" live={live} name={partnerName} />;
  return (
    <div className={s.split}>
      {role === "A" ? [mine, theirs] : [theirs, mine]}
      {children}
    </div>
  );
}

function SelfTile({ attach, status }: { attach: Camera["attach"]; status: Camera["status"] }) {
  return (
    <div className={s.tile}>
      <video ref={attach} className={s.video} playsInline muted autoPlay aria-label="Your camera" />
      {status !== "ready" && <div className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-white/70">{status === "starting" ? "Starting…" : "Camera off"}</div>}
      <span className={s.tileLabel}>You</span>
    </div>
  );
}

function PartnerTile({ live, name }: { live: { status: LiveStatus; remote: MediaStream | null }; name: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== live.remote) v.srcObject = live.remote;
    if (live.remote) void v.play().catch(() => undefined);
  }, [live.remote]);
  const showing = live.status === "connected" && live.remote;
  return (
    <div className={s.tile}>
      <video ref={ref} className={s.video} playsInline muted autoPlay aria-label="Your person's camera" />
      {!showing && (
        <div className="absolute inset-0 grid place-items-center p-3 text-center text-xs leading-snug text-white/75">
          {live.status === "unavailable" ? (
            <span>Live view isn&rsquo;t available on this connection — you can still take photos together.</span>
          ) : live.status === "partner-paused" ? (
            <span>{name} paused their video — they may have stepped away. You can still chat.</span>
          ) : live.status === "off" ? (
            <span>Video paused</span>
          ) : (
            <span className="flex flex-col items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full bg-white/70 ${s.pulse}`} />
              Connecting to {name}…
            </span>
          )}
        </div>
      )}
      <span className={s.tileLabel}>{name}</span>
    </div>
  );
}

export function Progress({ round, done }: { round: number; done: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5" aria-label={`Photo ${round} of ${PHOTOBOOTH_ROUNDS}`}>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: PHOTOBOOTH_ROUNDS }, (_, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-full transition ${i < done ? "bg-rose" : i === done ? "bg-rose/60 ring-2 ring-rose/25" : "bg-line"}`} />
        ))}
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-soft">
        Photo {round} of {PHOTOBOOTH_ROUNDS}
      </p>
    </div>
  );
}

const ISSUE_TEXT: Record<CameraIssue, string> = {
  denied: "is having trouble — their browser blocked the camera",
  unavailable: "is having trouble accessing their camera",
  in_use: "is having trouble — their camera is busy in another app",
  unsupported: "is having trouble — their browser can't use the camera",
  other: "is having trouble accessing their camera",
};

/** "Your person" status line with a little live dot. */
export function PartnerStatus({ partner, waitingFor }: { partner: BoothPersonState; waitingFor?: string }) {
  const name = partner.name ?? "Your person";
  let dot = "bg-line";
  let text = `Waiting for ${partner.name ?? "your person"} to open their link…`;
  if (partner.joined && !partner.connected) {
    dot = "bg-amber-400";
    text = `${name} disconnected. We're waiting for them to come back.`;
  } else if (partner.connected && partner.cameraIssue) {
    dot = "bg-amber-400";
    text = `${name} ${ISSUE_TEXT[partner.cameraIssue]}.`;
  } else if (partner.connected) {
    dot = "bg-emerald-500";
    text = waitingFor ?? `${name} is here`;
  }
  return (
    <p className="flex items-center gap-2 text-sm text-ink-soft" role="status">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot} ${partner.connected ? "" : s.pulse}`} aria-hidden />
      {text}
    </p>
  );
}

export function CopyButton({ text, label, copiedLabel = "Copied", className = "" }: { text: string; label: string; copiedLabel?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await copyText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }}
      className={`lw-press inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-rose ${className}`}
    >
      {copied ? <Icon.check size={15} /> : <Icon.copy size={15} />}
      {copied ? copiedLabel : label}
    </button>
  );
}

function browserHint(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

const ISSUE_TITLE: Record<CameraIssue, string> = {
  denied: "We need camera access to use the photobooth.",
  unavailable: "We couldn't access your camera.",
  in_use: "Your camera may be in use by another app or browser tab.",
  unsupported: "This browser can't use the camera here.",
  other: "We couldn't access your camera.",
};

/**
 * Camera trouble: reassure (nothing is lost), then fix → retry. Also offers another device,
 * coming back later and support — never a dead end, never a new payment.
 */
export function CameraTrouble({
  issue,
  onRetry,
  retrying,
  myLink,
  onLater,
  paid = true,
}: {
  /** Person A paid; Person B didn't — so only A is told they won't be charged again. */
  paid?: boolean;
  issue: CameraIssue;
  onRetry: () => void;
  retrying: boolean;
  myLink: string;
  onLater: () => void;
}) {
  const [showHow, setShowHow] = useState(issue === "denied");
  const device = browserHint();
  return (
    <Card className={s.enter}>
      <p className="font-display text-xl">{ISSUE_TITLE[issue]}</p>
      <p className="mt-1.5 text-sm text-ink-soft">
        Your photobooth is safe — nothing has been lost{paid ? <>, and you won&rsquo;t be charged again</> : null}. Let&rsquo;s fix it and try again.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="lw-press rounded-full bg-rose px-5 py-3 font-medium text-white hover:bg-rose-deep disabled:opacity-60"
        >
          {retrying ? "Trying…" : "Try again"}
        </button>
        <button type="button" onClick={() => setShowHow((v) => !v)} className="rounded-full bg-white px-5 py-3 font-medium ring-1 ring-line hover:ring-ink/30">
          How to allow camera access
        </button>
      </div>
      {showHow && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
          {issue === "in_use" ? (
            <p>Close other apps or tabs that use the camera (video calls, the Camera app), then tap Try again.</p>
          ) : issue === "unsupported" ? (
            <p>
              Open your link in <strong>Chrome</strong> or <strong>Safari</strong>. Built-in browsers inside apps (Messenger, Instagram) often
              can&rsquo;t use the camera — tap <strong>⋯</strong> → <strong>Open in browser</strong>.
            </p>
          ) : device === "ios" ? (
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                In Safari, tap <strong>aA</strong> (or the page settings icon) in the address bar → <strong>Website Settings</strong>.
              </li>
              <li>
                Set <strong>Camera</strong> to <strong>Allow</strong>, then tap Try again.
              </li>
              <li>Still blocked? Settings → Safari → Camera → Allow.</li>
            </ol>
          ) : device === "android" ? (
            <ol className="list-decimal space-y-1 pl-5">
              <li>Tap the lock / settings icon next to the address bar.</li>
              <li>
                Tap <strong>Permissions</strong> → <strong>Camera</strong> → <strong>Allow</strong>, then tap Try again.
              </li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1 pl-5">
              <li>Click the camera or lock icon in the address bar and allow the camera.</li>
              <li>Make sure no other app (Zoom, Teams, FaceTime) is using it, then click Try again.</li>
            </ol>
          )}
        </div>
      )}
      <div className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
        <div>
          <p className="font-medium">Try another phone or computer</p>
          <p className="text-ink-soft">Open your private photobooth link on any device with a working camera.</p>
          <CopyButton text={myLink} label="Copy my private link" copiedLabel="Link copied" className="mt-2" />
        </div>
        <div>
          <button type="button" onClick={onLater} className="font-medium text-rose underline underline-offset-4">
            I&rsquo;ll come back later
          </button>
        </div>
        <SupportLine />
      </div>
    </Card>
  );
}

export function SupportLine() {
  const href = ORDER_CONTACT.url || "mailto:lovewritten.business@gmail.com?subject=Photobooth%20help";
  return (
    <p className="text-xs text-ink-soft">
      Still having trouble? If a technical problem stops you from using your photobooth,{" "}
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-rose underline underline-offset-2">
        contact us
      </a>{" "}
      and we&rsquo;ll help you recover your session.
    </p>
  );
}

/**
 * 3 · 2 · 1 · 📸 against the SERVER clock, so both phones count down together, then
 * `onCapture` fires once at the shutter moment.
 */
export function Countdown({ captureAt, serverNow, onCapture }: { captureAt: number; serverNow: () => number; onCapture: () => void }) {
  const [left, setLeft] = useState(() => captureAt - serverNow());
  const fired = useRef(false);
  const fire = useRef(onCapture);
  useEffect(() => {
    fire.current = onCapture;
  }, [onCapture]);
  useEffect(() => {
    fired.current = false;
    let raf = 0;
    const tick = () => {
      const ms = captureAt - serverNow();
      setLeft(ms);
      if (ms <= 0 && !fired.current) {
        fired.current = true;
        fire.current();
      }
      if (ms > -800) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // rAF pauses in background tabs; make sure the shutter still fires on time-ish.
    const backup = window.setTimeout(tick, Math.max(0, captureAt - serverNow()) + 30);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(backup);
    };
  }, [captureAt, serverNow]);

  const n = Math.ceil(left / 1000);
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-live="assertive">
      {left > 3000 ? (
        <p className="rounded-full bg-black/45 px-5 py-2 text-lg font-medium text-white backdrop-blur">Get ready…</p>
      ) : left > 0 ? (
        <span key={n} className={`font-display text-[7rem] leading-none text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)] ${s.digit}`}>
          {n}
        </span>
      ) : (
        <>
          <div className={s.flash} />
          <span className="text-6xl" aria-label="Photo taken">
            📸
          </span>
        </>
      )}
    </div>
  );
}

export function Hearts() {
  return <HeartIcon size={14} className="inline text-rose" />;
}
