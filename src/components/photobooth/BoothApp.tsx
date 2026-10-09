"use client";

/* eslint-disable @next/next/no-img-element -- photos are private signed URLs */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/ui/Brand";
import { Button, Spinner } from "@/components/ui/Button";
import { HeartIcon, Icon } from "@/components/ui/icons";
import { InAppBrowserNotice } from "@/components/studio/InAppBrowserNotice";
import { ClientApiError, newIdempotencyKey } from "@/lib/client/api";
import { boothApi, ownLink } from "@/lib/photobooth/client";
import { stableUrl } from "@/lib/photobooth/stable-url";
import { PHOTOBOOTH_RETENTION_DAYS, PHOTOBOOTH_TIMEZONE, RECONNECT_WINDOW_MS } from "@/lib/photobooth/constants";
import type { BoothState, CameraIssue, StripFilter } from "@/lib/photobooth/types";
import { formatPeso } from "@/lib/format";
import { DEFAULT_FRAME_ID, FRAMES, getFrame } from "@/photobooth/frames";
import { useBooth, type ConnectionQuality } from "./useBooth";
import { useCamera, type Camera } from "./useCamera";
import { useLiveVideo, type LiveStatus } from "./useLiveVideo";
import { useIdle } from "./useIdle";
import { CameraTrouble, CameraView, Card, CopyButton, Countdown, PartnerStatus, Progress, SplitView, SupportLine } from "./BoothParts";
import { StripPreview } from "./StripPreview";
import { BoothChat } from "./BoothChat";
import s from "./photobooth.module.css";

/**
 * One participant's photobooth. The server state decides the screen:
 *   AWAITING_PAYMENT → PAID (name · camera check · invite · 7-day notice · waiting)
 *   → IN_PROGRESS (ready → countdown → review, ×4) → DESIGNING (filter + frame)
 *   → GENERATING → COMPLETED
 * From the lobby on: live strip preview on the left, the two of you in the middle,
 * chat on the right (stacked on phones).
 */
export function BoothApp({ sessionId, justPaid, cancelled }: { sessionId: string; justPaid: boolean; cancelled: boolean }) {
  const idle = useIdle(true);
  const booth = useBooth(sessionId, { slow: idle.state === "paused" });
  const camera = useCamera();
  const [away, setAway] = useState(false);
  const { state, token } = booth;
  const status = state?.status;

  // Camera on while it's needed, off otherwise (never left running in the background).
  const needsCamera = !away && (status === "PAID" || status === "IN_PROGRESS" || status === "DESIGNING");
  const autoStart = needsCamera && Boolean(state?.me.cameraReady || status === "IN_PROGRESS");
  const { start, stop, status: camStatus } = camera;
  useEffect(() => {
    if (autoStart && camStatus === "idle") void start();
    if (!needsCamera && camStatus === "ready") stop();
  }, [autoStart, needsCamera, camStatus, start, stop]);

  // Live view: see each other from the lobby until the look is chosen. Paused while away.
  const liveStage = status === "IN_PROGRESS" || status === "DESIGNING" || (status === "PAID" && Boolean(state?.me.cameraReady));
  const live = useLiveVideo({
    sessionId,
    token: token ?? "",
    role: state?.me.role ?? "A",
    enabled: Boolean(token) && !away && liveStage,
    paused: idle.state === "paused",
    stream: camera.liveStream,
    partnerSignal: state?.partnerSignal ?? null,
  });
  // While the two browsers are finding each other, check for the other's reply more often.
  const { refresh } = booth;
  useEffect(() => {
    if (live.status !== "connecting") return;
    const id = window.setInterval(() => void refresh(), 1200);
    return () => window.clearInterval(id);
  }, [live.status, refresh]);

  if (token === undefined) return <Shell><Loading /></Shell>;
  if (token === null) return <Shell><NoLink /></Shell>;
  if (booth.loadError) return <Shell><LoadError error={booth.loadError} onRetry={() => void booth.refresh()} /></Shell>;
  if (!state) return <Shell><Loading /></Shell>;

  const myLink = ownLink(sessionId, token);
  const goAway = () => {
    camera.stop();
    setAway(true);
  };
  const leave = () => {
    if (window.confirm("Leave the photobooth? It stays saved — come back anytime with your private link.")) goAway();
  };

  if (away) {
    return (
      <Shell>
        <AwayScreen myLink={myLink} onBack={() => setAway(false)} />
      </Shell>
    );
  }

  const props: ScreenProps = { booth, state, camera, live, myLink, sessionId, token, justPaid, cancelled, onAway: goAway };
  const partnerName = state.partner.name ?? "Your person";
  const wide = isWide(state);
  const canLeave = status === "PAID" || status === "IN_PROGRESS" || status === "DESIGNING";

  return (
    <Shell onLeave={canLeave ? leave : undefined} offline={booth.offline} wide={wide}>
      <InAppBrowserNotice surpriseId={sessionId} link={() => myLink} message="The camera may not work in this built-in browser." />
      {liveStage && idle.state !== "active" && <AwayPrompt state={idle.state} onHere={idle.resume} />}
      {wide ? (
        <Stage
          left={status === "COMPLETED" ? null : <LivePreview state={state} />}
          main={<Screen {...props} />}
          right={
            <BoothChat
              sessionId={sessionId}
              token={token}
              messages={state.messages}
              partnerName={partnerName}
              onSent={() => void booth.refresh()}
              className="h-full"
            />
          }
        />
      ) : (
        <Screen {...props} />
      )}
    </Shell>
  );
}

type Booth = ReturnType<typeof useBooth>;
type Live = { status: LiveStatus; remote: MediaStream | null; retry?: () => void };
type ScreenProps = {
  booth: Booth;
  state: BoothState;
  camera: Camera;
  live: Live;
  myLink: string;
  sessionId: string;
  token: string;
  justPaid: boolean;
  cancelled: boolean;
  onAway: () => void;
};

/** Screens that get the three-column stage (preview · main · chat). */
function isWide(state: BoothState) {
  if (state.status === "PAID") return Boolean(state.me.name && state.me.cameraReady);
  return state.status === "IN_PROGRESS" || state.status === "DESIGNING" || state.status === "GENERATING" || state.status === "COMPLETED";
}

function Screen(props: ScreenProps) {
  const { state } = props;
  switch (state.status) {
    case "AWAITING_PAYMENT":
      return <PaymentScreen {...props} />;
    case "PAID":
      if (!state.me.name) return <NameStep booth={props.booth} state={state} />;
      return <Lobby {...props} />;
    case "IN_PROGRESS":
      return <Rounds {...props} />;
    case "DESIGNING":
      return <DesignStep booth={props.booth} state={state} />;
    case "GENERATING":
      return <Generating />;
    case "FINALIZATION_FAILED":
      return <FinalizeFailed booth={props.booth} />;
    case "COMPLETED":
      return <Result state={state} />;
    default:
      return <Ended />;
  }
}

/** Desktop: preview | main | chat. Phones: main first, then preview + chat side by side. */
function Stage({ left, main, right }: { left: ReactNode; main: ReactNode; right: ReactNode }) {
  return (
    <div className={`grid gap-4 lg:items-start ${left ? "lg:grid-cols-[minmax(0,190px)_minmax(0,1fr)_minmax(0,320px)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]"}`}>
      <div className={`min-w-0 lg:row-start-1 ${left ? "lg:col-start-2" : "lg:col-start-1"}`}>{main}</div>
      <div className={`grid gap-3 lg:contents ${left ? "grid-cols-[84px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)]" : ""}`}>
        {left && <aside className="min-w-0 lg:sticky lg:top-4 lg:col-start-1 lg:row-start-1">{left}</aside>}
        <aside className={`h-[340px] min-w-0 lg:sticky lg:top-4 lg:row-start-1 lg:h-[min(640px,calc(100svh-7rem))] ${left ? "lg:col-start-3" : "lg:col-start-2"}`}>
          {right}
        </aside>
      </div>
    </div>
  );
}

/** The strip as it will look, filling in as photos are kept (and showing your pick while choosing). */
function LivePreview({ state }: { state: BoothState }) {
  const frame = getFrame(state.me.pick.frame ?? state.frameId) ?? getFrame(DEFAULT_FRAME_ID)!;
  const filter: StripFilter = state.me.pick.filter ?? state.finalFilter ?? (frame.grayscale ? "bw" : "color");
  return (
    <div>
      <StripPreview frame={frame} approved={state.approved} filter={filter} />
      <p className="mt-2 text-center text-[11px] leading-tight text-ink-soft">
        Your strip · {state.approved.length}/4
      </p>
    </div>
  );
}

/** "Are you still there?" — and the paused state after no answer. */
function AwayPrompt({ state, onHere }: { state: "asking" | "paused"; onHere: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="dialog" aria-live="assertive">
      <div className={`flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-cream shadow-2xl ${s.enter}`}>
        <span className="text-xl" aria-hidden>
          {state === "asking" ? "👀" : "⏸️"}
        </span>
        <p className="flex-1 text-sm">
          {state === "asking" ? (
            <>
              <strong>Are you still there?</strong> We&rsquo;ll pause the video in a minute to save data.
            </>
          ) : (
            <>
              <strong>Video paused</strong> while you were away. Your photobooth is safe.
            </>
          )}
        </p>
        <button type="button" onClick={onHere} className="lw-press shrink-0 rounded-full bg-rose px-4 py-2 text-sm font-medium text-white hover:bg-rose-deep">
          {state === "asking" ? "I'm here" : "Resume"}
        </button>
      </div>
    </div>
  );
}

/** How this person's connection is doing — so a slow phone knows why things lag. */
function ConnectionBadge({ quality }: { quality: ConnectionQuality }) {
  const look = {
    good: { dot: "bg-emerald-500", text: "Good connection", hint: "" },
    slow: { dot: "bg-amber-400", text: "Slow connection", hint: "The countdown may feel short — Wi-Fi helps." },
    weak: { dot: "bg-danger", text: "Weak connection", hint: "Things may lag. Try Wi-Fi or a spot with better signal." },
  }[quality];
  return (
    <p className="flex items-center justify-center gap-1.5 text-xs text-ink-soft" role="status">
      <span className={`h-2 w-2 shrink-0 rounded-full ${look.dot}`} aria-hidden />
      <span className="font-medium text-ink">{look.text}</span>
      {look.hint && <span className="hidden sm:inline">· {look.hint}</span>}
    </p>
  );
}

// ─── Payment (Person A only; Person B never pays) ───────────────────────────

function PaymentScreen({ state, sessionId, token, justPaid, cancelled }: ScreenProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (state.me.role === "B") {
    return (
      <Card className="text-center">
        <p className="font-display text-2xl">Almost there</p>
        <p className="mt-2 text-ink-soft">Your person is still setting up this photobooth. Keep this link — it&rsquo;ll open as soon as they&rsquo;re done.</p>
      </Card>
    );
  }
  const confirming = justPaid && !cancelled && state.paymentStatus !== "PAYMENT_FAILED";
  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const key = sessionStorage.getItem(`lw:booth-pay:${sessionId}`) ?? newIdempotencyKey();
      sessionStorage.setItem(`lw:booth-pay:${sessionId}`, key);
      const res = await boothApi<{ kind: string; checkoutUrl?: string }>(sessionId, token, "/checkout", { method: "POST", body: { idempotencyKey: key } });
      if (res.checkoutUrl) window.location.assign(res.checkoutUrl);
      else window.location.reload();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }
  return (
    <Card className="text-center">
      {confirming ? (
        <>
          <Spinner className="mx-auto h-7 w-7 text-rose" />
          <p className="mt-4 font-display text-2xl">Confirming your payment…</p>
          <p className="mt-2 text-sm text-ink-soft">This usually takes a few seconds. You can keep this page open.</p>
        </>
      ) : (
        <>
          <p className="font-display text-2xl">{state.paymentStatus === "PAYMENT_FAILED" ? "That payment didn't go through" : "One step left"}</p>
          <p className="mt-2 text-ink-soft">
            {cancelled ? "No worries — you haven't been charged. " : ""}Pay {formatPeso(state.priceCentavos)} to open your photobooth. Your person joins free.
          </p>
          <Button className="mt-5 w-full" onClick={pay} busy={busy} busyLabel="Opening payment…">
            Pay {formatPeso(state.priceCentavos)}
          </Button>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </>
      )}
    </Card>
  );
}

// ─── Lobby: name → camera check → invite → 7-day notice → waiting ───────────

function NameStep({ booth, state }: { booth: Booth; state: BoothState }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="mx-auto max-w-md">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setBusy(true);
          setError(null);
          try {
            await booth.act("/lobby", { displayName: name.trim() });
          } catch (err) {
            setError(err instanceof ClientApiError ? err.message : "Something went wrong. Please try again.");
            setBusy(false);
          }
        }}
      >
        <h1 className="font-display text-3xl">What should we call you?</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {state.partner.name ? `${state.partner.name} will see this name.` : "Your person will see this name in the photobooth."}
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          autoFocus
          autoComplete="given-name"
          placeholder={state.me.role === "A" ? "e.g. Vinz" : "e.g. Samantha"}
          aria-label="Your name"
          className="mt-4 w-full rounded-2xl bg-white px-4 py-3.5 text-lg ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-rose/40"
        />
        <Button type="submit" className="mt-4 w-full py-4" busy={busy} disabled={!name.trim()}>
          Continue
        </Button>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </form>
    </Card>
  );
}

function Lobby({ booth, state, camera, live, myLink, onAway }: ScreenProps) {
  const { me, partner } = state;
  const partnerName = partner.name ?? "your person";
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reported = useRef<CameraIssue | null>(null);

  // Tell the server (for your partner and for support) when the camera fails.
  useEffect(() => {
    if (camera.status === "error" && camera.issue && reported.current !== camera.issue) {
      reported.current = camera.issue;
      void booth.act("/lobby", { cameraIssue: camera.issue }).catch(() => undefined);
    }
  }, [camera.status, camera.issue, booth]);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await booth.act("/lobby", body);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Something went wrong. Your photobooth is safe — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const retryCamera = async () => {
    const issue = await camera.start();
    if (!issue) {
      reported.current = null;
      await send({ cameraReady: true });
    }
  };

  // Camera check (after payment, before anything else).
  if (!me.cameraReady) {
    if (camera.status === "error" && camera.issue) {
      return <CameraTrouble paid={me.role === "A"} issue={camera.issue} onRetry={retryCamera} retrying={false} myLink={myLink} onLater={onAway} />;
    }
    return (
      <div className="mx-auto max-w-md space-y-5">
        <div className="text-center">
          <h1 className="font-display text-3xl">Hi {me.name}! Let&rsquo;s make sure your camera works.</h1>
          <p className="mt-2 text-ink-soft">
            {me.role === "A" ? "We'll check your camera before you invite your person." : "A quick check before your photobooth starts."}
          </p>
        </div>
        <CameraView camera={camera} />
        {camera.status === "ready" ? (
          <>
            <p className="flex items-center justify-center gap-2 font-medium text-emerald-700">
              <Icon.check size={18} /> Camera ready
            </p>
            <Button className="w-full py-4" busy={busy} onClick={() => void send({ cameraReady: true })}>
              Continue
            </Button>
          </>
        ) : (
          <Button className="w-full py-4" busy={camera.status === "starting"} busyLabel="Waiting for your camera…" onClick={() => void retryCamera()}>
            Turn on my camera
          </Button>
        )}
        <p className="text-center text-xs text-ink-soft">Your camera stays on your device — we only save the photos you take.</p>
      </div>
    );
  }

  // Person A starts the photobooth (after reading the 7-day rule); Person B waits for them.
  const partnerSet = partner.joined && partner.connected && partner.cameraReady;
  const waitingFor = !partner.joined
    ? `Waiting for ${partnerName}…`
    : !partner.name
      ? "They're opening the photobooth…"
      : !partner.cameraReady
        ? `Waiting for ${partnerName} to turn on their camera…`
        : me.role === "B"
          ? `${partner.name} will start the photobooth ❤️`
          : `${partner.name} is here and ready ❤️`;

  const startCard =
    me.role === "A" ? (
      me.acknowledged ? (
        <Card className="text-center">
          <p className="font-medium">Starting as soon as {partnerName}&rsquo;s camera is on…</p>
        </Card>
      ) : showRules ? (
        <Card className={`ring-2 ring-rose shadow-[0_18px_40px_-20px_rgba(196,72,106,0.6)] ${s.enter}`}>
          <h2 className="font-display text-2xl">Before you start: your photos are temporary.</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Once your photobooth is completed, your photos and photobooth strip will be available for {PHOTOBOOTH_RETENTION_DAYS} days. After that,
            they will be <strong className="text-ink">permanently deleted</strong>. Download your photos before they expire.
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-line">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-rose" />
            <span>I understand that our photos will be deleted after {PHOTOBOOTH_RETENTION_DAYS} days.</span>
          </label>
          <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
            <Button variant="secondary" onClick={() => setShowRules(false)}>
              Back
            </Button>
            <Button disabled={!agree} busy={busy} busyLabel="Starting…" onClick={() => void send({ acknowledge: true, ...(state.frameId ? {} : { frameId: DEFAULT_FRAME_ID }) })}>
              Start the photobooth 📸
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          <Button className="w-full py-4 text-lg" disabled={!partnerSet} onClick={() => setShowRules(true)}>
            Let&rsquo;s Start!
          </Button>
          {!partnerSet && <p className="text-center text-xs text-ink-soft">You can start once {partnerName} is here with their camera on.</p>}
        </div>
      )
    ) : (
      <Card className="text-center">
        <p className="font-medium">Waiting for {partner.name ?? "your person"} to start the photobooth…</p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
          Heads up: once you&rsquo;re done, your photos stay downloadable for {PHOTOBOOTH_RETENTION_DAYS} days, then they&rsquo;re permanently deleted.
        </p>
      </Card>
    );

  return (
    <div className="space-y-4">
      {camera.status === "error" && camera.issue ? (
        <CameraTrouble paid={me.role === "A"} issue={camera.issue} onRetry={retryCamera} retrying={false} myLink={myLink} onLater={onAway} />
      ) : (
        <SplitView camera={camera} role={me.role} live={live} partnerName={partner.name ?? "Your person"} />
      )}

      {startCard}

      <Card>
        <PartnerStatus partner={partner} waitingFor={waitingFor} />
        <div className="mt-2 border-t border-line pt-2">
          <ConnectionBadge quality={booth.quality} />
        </div>
      </Card>

      {me.role === "A" && state.inviteLink && <InviteCard link={state.inviteLink} joined={partner.joined} myName={me.name} />}
      {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
      <SupportLine />
    </div>
  );
}

function InviteCard({ link, joined, myName }: { link: string; joined: boolean; myName: string | null }) {
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <Card className="bg-[linear-gradient(135deg,#fbe9ec,#fffdfa)] ring-blush">
      <h2 className="font-display text-xl">{joined ? "Your person has their link ✓" : "Invite your person"}</h2>
      <p className="mt-1.5 text-sm text-ink-soft">
        Send them this private link. It&rsquo;s only for them — they don&rsquo;t need to pay, and it&rsquo;s different from your own link.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={link} label="Copy invite link" copiedLabel="Invite link copied" />
        {canShare && (
          <button
            type="button"
            onClick={() =>
              void navigator
                .share({ title: "Our photobooth", text: `${myName ? `${myName} invited you to` : "Join me in"} our little photobooth ❤️`, url: link })
                .catch(() => undefined)
            }
            className="lw-press inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-medium ring-1 ring-line hover:ring-ink/30"
          >
            <Icon.send size={15} /> Share
          </button>
        )}
      </div>
    </Card>
  );
}

// ─── The four photos ────────────────────────────────────────────────────────

function Rounds({ booth, state, camera, live, myLink, sessionId, token, onAway }: ScreenProps) {
  const { me, partner, phase, attempt, round } = state;
  const partnerName = partner.name ?? "Your person";
  const step = `${attempt}:${phase}`;
  const [busyStep, setBusyStep] = useState<string | null>(null);
  const busy = busyStep === step;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shotFor = useRef<number | null>(null);

  const act = async (path: string, body: unknown) => {
    setBusyStep(step);
    setError(null);
    try {
      await booth.act(path, body);
    } catch (err) {
      if (!(err instanceof ClientApiError && err.code === "BOOTH_STALE")) setError("That didn't go through — please tap again.");
    } finally {
      setBusyStep((b) => (b === step ? null : b));
    }
  };

  // The shutter: capture locally, upload the still (retrying safely — same attempt, same file).
  const onCapture = useCallback(async () => {
    if (shotFor.current === attempt) return;
    shotFor.current = attempt;
    setSaving(true);
    setError(null);
    let blob = await camera.capture();
    if (!blob && !(await camera.start())) blob = await camera.capture();
    if (!blob) {
      setSaving(false);
      setError("We couldn't take that photo — your camera stopped. We'll restart this photo for both of you.");
      return;
    }
    for (let tries = 0; tries < 4; tries++) {
      try {
        const form = new FormData();
        form.append("attempt", String(attempt));
        form.append("file", blob, "photo.jpg");
        await boothApi(sessionId, token, "/shot", { method: "POST", body: form, retries: 2 });
        setError(null);
        break;
      } catch (err) {
        if (err instanceof ClientApiError && (err.code === "BOOTH_STALE" || err.status === 400)) break;
        setError("Something went wrong while saving this photo. We're going to try again.");
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    setSaving(false);
    void booth.refresh();
  }, [attempt, camera, sessionId, token, booth]);

  const partnerAway = partner.joined && !partner.connected;
  const longAway = partnerAway && (partner.awayMs ?? 0) > RECONNECT_WINDOW_MS;

  return (
    <div className="space-y-4">
      <Progress round={round} done={round - 1} />
      <ConnectionBadge quality={booth.quality} />

      {state.notice && phase === "READY" && (
        <p className={`rounded-2xl bg-petal px-4 py-3 text-center text-sm ${s.enter}`}>
          {state.notice.kind === "aborted"
            ? "That one didn't go through — let's try again ❤️"
            : state.notice.by === "partner"
              ? `${partnerName} wants another take. Let's try that one again ❤️`
              : "Let's try that one again ❤️"}
        </p>
      )}

      {partnerAway && (
        <Card className="text-center">
          <PartnerStatus partner={partner} />
          {longAway && (
            <p className="mt-2 text-xs text-ink-soft">They&rsquo;ve been away for a while. Your photobooth is saved — you can both come back later with your links.</p>
          )}
        </Card>
      )}

      {camera.status === "error" && camera.issue && (
        <CameraTrouble paid={me.role === "A"} issue={camera.issue} onRetry={() => void camera.start()} retrying={false} myLink={myLink} onLater={onAway} />
      )}

      {phase === "REVIEW" && state.review ? (
        <Card className={s.enter}>
          <div className="grid grid-cols-2 gap-3">
            {(me.role === "A"
              ? [
                  { p: state.review.mine, who: "You" },
                  { p: state.review.theirs, who: partnerName },
                ]
              : [
                  { p: state.review.theirs, who: partnerName },
                  { p: state.review.mine, who: "You" },
                ]
            ).map(({ p, who }) => (
              <figure key={p.key} className="m-0">
                <img src={stableUrl(p)} alt={`${who} — photo ${round}`} className="aspect-[3/4] w-full rounded-2xl object-cover shadow-md" />
                <figcaption className="mt-1.5 text-center text-xs font-medium text-ink-soft">{who}</figcaption>
              </figure>
            ))}
          </div>
          {me.decision ? (
            <p className="mt-4 text-center text-sm text-ink-soft">
              {me.decision === "KEEP" ? "You kept this one ✓ " : ""}
              {partner.decision ? "" : `Waiting for ${partnerName}…`}
            </p>
          ) : (
            <>
              <p className="mt-4 text-center font-display text-xl">Do you like this one?</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button variant="secondary" className="py-4" disabled={busy} onClick={() => void act("/decide", { attempt, decision: "RETAKE" })}>
                  Retake
                </Button>
                <Button className="py-4" disabled={busy} onClick={() => void act("/decide", { attempt, decision: "KEEP" })}>
                  Keep ❤️
                </Button>
              </div>
              <p className="mt-2 text-center text-xs text-ink-soft">You both need to keep it. If either of you wants a retake, you both retake it.</p>
            </>
          )}
        </Card>
      ) : (
        <>
          <SplitView camera={camera} role={me.role} live={live} partnerName={partnerName}>
            {phase === "COUNTDOWN" && state.captureAt && !me.uploaded && <Countdown captureAt={state.captureAt} serverNow={booth.serverNow} onCapture={() => void onCapture()} />}
            {phase === "COUNTDOWN" && (me.uploaded || saving) && (
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/50 px-4 py-3 text-center text-sm text-white backdrop-blur">
                {saving && !me.uploaded ? "Saving your photo…" : `Got it! Waiting for ${partnerName}'s photo…`}
              </div>
            )}
          </SplitView>
          {phase === "READY" && live.status === "connected" && (
            <p className="text-center text-xs text-ink-soft">This is how you&rsquo;ll appear side by side on your strip — strike a pose together.</p>
          )}
          {phase === "READY" && (
            <div className="space-y-2">
              <p className="text-center font-display text-xl">Get ready.</p>
              {me.ready ? (
                <p className="rounded-full bg-white py-3 text-center text-sm font-medium ring-1 ring-line">
                  {partner.ready ? "Here we go!" : `You're ready ✓ — waiting for ${partnerName}…`}
                </p>
              ) : (
                <Button className="w-full py-4 text-base" busy={busy} disabled={camera.status !== "ready"} onClick={() => void act("/ready", { attempt })}>
                  I&rsquo;m Ready
                </Button>
              )}
              {!me.ready && partner.ready && <p className="text-center text-sm text-ink-soft">{partnerName} is ready!</p>}
            </div>
          )}
        </>
      )}
      {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}

// ─── Choose the look (after the four photos) ────────────────────────────────

const FILTERS: { id: StripFilter; label: string }[] = [
  { id: "bw", label: "Black & white" },
  { id: "color", label: "Color" },
];

function DesignStep({ booth, state }: { booth: Booth; state: BoothState }) {
  const { me, partner } = state;
  const partnerName = partner.name ?? "Your person";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameId = me.pick.frame ?? DEFAULT_FRAME_ID;
  const filter: StripFilter = me.pick.filter ?? "bw";
  const frame = getFrame(frameId) ?? getFrame(DEFAULT_FRAME_ID)!;

  const pick = async (next: { frameId?: string; filter?: StripFilter }, confirm = false) => {
    setBusy(true);
    setError(null);
    try {
      await booth.act("/pick", { frameId: next.frameId ?? frameId, filter: next.filter ?? filter, confirm });
    } catch (err) {
      if (!(err instanceof ClientApiError && err.code === "BOOTH_STALE")) setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const same = partner.pick.frame === frameId && partner.pick.filter === filter;
  const label = (f: string | null, fl: StripFilter | null) =>
    `${FILTERS.find((x) => x.id === fl)?.label ?? "?"} · ${getFrame(f)?.name ?? "?"} frame`;
  let statusLine: string;
  if (me.pick.confirmed && partner.pick.confirmed && !same) {
    statusLine = `You picked ${label(frameId, filter)}, ${partnerName} picked ${label(partner.pick.frame, partner.pick.filter)}. Choose the same look to make your strip — chat to decide!`;
  } else if (me.pick.confirmed) {
    statusLine = `Waiting for ${partnerName} to choose…`;
  } else if (partner.pick.confirmed) {
    statusLine = `${partnerName} chose ${label(partner.pick.frame, partner.pick.filter)}. Tap “Use this look” when you're happy.`;
  } else {
    statusLine = "Pick a filter and a frame. Your strip is made when you both choose the same look.";
  }

  const Badge = ({ mine, theirs }: { mine: boolean; theirs: boolean }) => (
    <span className="mt-1.5 flex min-h-5 flex-wrap justify-center gap-1">
      {mine && <span className="rounded-full bg-rose px-2 py-0.5 text-[10px] font-medium text-white">You</span>}
      {theirs && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-cream">{partnerName} picks this</span>}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-soft">All four photos are in ❤️</p>
        <h1 className="mt-1 font-display text-3xl">Make it yours</h1>
      </div>

      <div className="mx-auto w-40 lg:hidden">
        <StripPreview frame={frame} approved={state.approved} filter={filter} />
      </div>

      <Card>
        <h2 className="text-sm font-semibold">Filter</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {FILTERS.map((f) => {
            const mine = f.id === filter;
            return (
              <button
                key={f.id}
                type="button"
                disabled={busy}
                onClick={() => !mine && void pick({ filter: f.id })}
                aria-pressed={mine}
                className={`rounded-2xl bg-white p-3 text-center transition ${mine ? "ring-2 ring-rose" : "ring-1 ring-line hover:ring-ink/30"}`}
              >
                <span className={`mx-auto block h-14 w-full rounded-lg bg-[linear-gradient(135deg,#e85d84,#ffd36e,#6fb6e8)] ${f.id === "bw" ? "grayscale" : ""}`} />
                <span className="mt-2 block text-sm font-medium">{f.label}</span>
                <Badge mine={mine} theirs={partner.pick.filter === f.id} />
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Frame</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {FRAMES.map((f) => {
            const mine = f.id === frameId;
            return (
              <button
                key={f.id}
                type="button"
                disabled={busy}
                onClick={() => !mine && void pick({ frameId: f.id })}
                aria-pressed={mine}
                className={`rounded-2xl bg-white p-3 text-center transition ${mine ? "ring-2 ring-rose" : "ring-1 ring-line hover:ring-ink/30"}`}
              >
                <span className="mx-auto block h-14 w-9 rounded-sm ring-1 ring-black/10" style={{ background: f.background }} />
                <span className="mt-2 block text-sm font-medium">{f.name}</span>
                <Badge mine={mine} theirs={partner.pick.frame === f.id} />
              </button>
            );
          })}
        </div>
      </Card>

      <p className="text-center text-sm text-ink-soft" role="status">
        {statusLine}
      </p>
      {me.pick.confirmed ? (
        <p className="rounded-full bg-white py-3 text-center text-sm font-medium ring-1 ring-line">
          You chose {label(frameId, filter)} ✓ <span className="text-ink-soft">— change it above anytime</span>
        </p>
      ) : (
        <Button className="w-full py-4 text-base" busy={busy} onClick={() => void pick({}, true)}>
          Use this look
        </Button>
      )}
      {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}

// ─── After choosing ─────────────────────────────────────────────────────────

function Generating() {
  return (
    <Card className="text-center">
      <div className="mx-auto flex w-16 flex-col gap-1.5 rounded-md bg-ink p-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-8 rounded-sm bg-white/80 ${s.pulse}`} style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
      <p className="mt-5 font-display text-2xl">Generating your photobooth…</p>
      <p className="mt-2 text-sm text-ink-soft">Putting your four moments together. This takes a few seconds.</p>
    </Card>
  );
}

function FinalizeFailed({ booth }: { booth: Booth }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card className="text-center">
      <p className="font-display text-2xl">We couldn&rsquo;t finish your photobooth right now.</p>
      <p className="mt-2 text-ink-soft">Your session is still safe — all four photos are saved. Please try again.</p>
      <Button
        className="mt-5 w-full"
        busy={busy}
        onClick={async () => {
          setBusy(true);
          await booth.act("/finalize", {}).catch(() => undefined);
          setBusy(false);
        }}
      >
        Try again
      </Button>
      <div className="mt-4">
        <SupportLine />
      </div>
    </Card>
  );
}

function Result({ state }: { state: BoothState }) {
  const result = state.result;
  if (!result) return <Ended />;
  const until = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: PHOTOBOOTH_TIMEZONE }).format(new Date(result.expiresAt));
  const names = state.me.name && state.partner.name ? (state.me.role === "A" ? `${state.me.name} & ${state.partner.name}` : `${state.partner.name} & ${state.me.name}`) : null;
  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">
          You made a little memory together. <HeartIcon size={24} className="inline text-rose" />
        </h1>
        {names && <p className="mt-2 text-ink-soft">{names}</p>}
      </div>
      <img src={result.strip.url} alt="Your photobooth strip" className={`mx-auto w-full max-w-[17rem] rounded-sm shadow-[0_30px_60px_-25px_rgba(0,0,0,0.6)] ${s.strip}`} />
      <div className="mx-auto max-w-sm space-y-2">
        <a href={result.strip.download} className="lw-press flex w-full items-center justify-center gap-2 rounded-full bg-rose px-5 py-4 font-medium text-white hover:bg-rose-deep">
          Download Photo Strip
        </a>
        <p className="text-xs text-ink-soft">On iPhone you can also press and hold the strip to save it to Photos.</p>
      </div>
      <Card>
        <h2 className="font-display text-lg">Your four photos</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {result.photos.map((p) => (
            <a key={p.round} href={p.download} className="group block rounded-xl bg-white p-1.5 text-sm ring-1 ring-line hover:ring-rose">
              <img src={p.url} alt={`Photo ${p.round}`} className="aspect-[3/2] w-full rounded-lg object-cover" loading="lazy" />
              <span className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-ink-soft group-hover:text-rose">Photo {p.round} · Download</span>
            </a>
          ))}
        </div>
      </Card>
      <div className="rounded-2xl bg-ink px-5 py-4 text-cream">
        <p className="font-medium">Available until {until}</p>
        <p className="mt-1 text-sm text-cream/75">Your photos will be permanently deleted after this date. Downloading doesn&rsquo;t extend it — save them now.</p>
      </div>
      <Link href="/photobooth" className="inline-block text-sm text-ink-soft underline underline-offset-4">
        Love, Written Photobooth
      </Link>
    </div>
  );
}

// ─── Small screens ──────────────────────────────────────────────────────────

function AwayScreen({ myLink, onBack }: { myLink: string; onBack: () => void }) {
  return (
    <Card className="text-center">
      <p className="font-display text-2xl">Your photobooth is saved.</p>
      <p className="mt-2 text-ink-soft">Come back anytime using your private link when you&rsquo;re ready. Nothing is lost, and the 7-day timer only starts once your photos are done.</p>
      <div className="mt-5 flex flex-col items-center gap-2">
        <CopyButton text={myLink} label="Copy my private link" copiedLabel="Link copied" />
        <button type="button" onClick={onBack} className="mt-1 text-sm font-medium text-rose underline underline-offset-4">
          Go back to the photobooth
        </button>
      </div>
    </Card>
  );
}

function Ended() {
  return (
    <Card className="text-center">
      <p className="font-display text-2xl">This photobooth has ended.</p>
      <p className="mt-2 text-ink-soft">Its photos were deleted after {PHOTOBOOTH_RETENTION_DAYS} days, as promised.</p>
      <Link href="/photobooth" className="mt-5 inline-block rounded-full bg-ink px-5 py-3 font-medium text-cream hover:bg-rose">
        Start a new photobooth
      </Link>
    </Card>
  );
}

function NoLink() {
  return (
    <Card className="text-center">
      <p className="font-display text-2xl">Open your private link</p>
      <p className="mt-2 text-ink-soft">This photobooth opens with the private link you were sent. Open that exact link (it ends with a long code) on this device.</p>
    </Card>
  );
}

function LoadError({ error, onRetry }: { error: { code: string; message: string }; onRetry: () => void }) {
  const full = error.code === "BOOTH_IN_USE";
  return (
    <Card className="text-center">
      <p className="font-display text-2xl">{full ? "This photobooth is already full" : error.code === "RATE_LIMITED" ? "One moment…" : "We couldn't open this photobooth"}</p>
      <p className="mt-2 text-ink-soft">{full ? "This link is open on another device right now. If that's you, close it there and try again in a moment." : error.message}</p>
      <Button variant="secondary" className="mt-5" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}

function Loading() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-rose">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

function Shell({ children, onLeave, offline, wide = false }: { children: ReactNode; onLeave?: () => void; offline?: boolean; wide?: boolean }) {
  const width = wide ? "max-w-6xl" : "max-w-xl";
  return (
    <div className="min-h-svh bg-[radial-gradient(80%_50%_at_50%_0%,#f9e2e7,transparent_70%)]">
      <header className={`mx-auto flex h-16 items-center justify-between px-4 ${width}`}>
        <Logo className="text-lg" />
        {onLeave && (
          <button type="button" onClick={onLeave} className="rounded-full px-3 py-2 text-sm text-ink-soft hover:bg-white/70 hover:text-ink">
            Leave photobooth
          </button>
        )}
      </header>
      {offline && (
        <p className={`mx-auto mb-2 px-4 text-center text-xs text-ink-soft ${width}`} role="status">
          Reconnecting… your photobooth is safe.
        </p>
      )}
      <main className={`mx-auto px-4 pb-24 pt-2 ${width}`}>{children}</main>
    </div>
  );
}
