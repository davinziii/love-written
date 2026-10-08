"use client";

/* eslint-disable @next/next/no-img-element -- photos are private signed URLs */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/Brand";
import { Button, Spinner } from "@/components/ui/Button";
import { HeartIcon, Icon } from "@/components/ui/icons";
import { InAppBrowserNotice } from "@/components/studio/InAppBrowserNotice";
import { ClientApiError, newIdempotencyKey } from "@/lib/client/api";
import { boothApi, ownLink } from "@/lib/photobooth/client";
import { PHOTOBOOTH_RETENTION_DAYS, PHOTOBOOTH_TIMEZONE, RECONNECT_WINDOW_MS } from "@/lib/photobooth/constants";
import type { BoothState, CameraIssue } from "@/lib/photobooth/types";
import { formatPeso } from "@/lib/format";
import { DEFAULT_FRAME_ID, FRAMES } from "@/photobooth/frames";
import { useBooth } from "./useBooth";
import { useCamera, type Camera } from "./useCamera";
import { CameraTrouble, CameraView, Card, CopyButton, Countdown, PartnerStatus, Progress, SupportLine } from "./BoothParts";
import s from "./photobooth.module.css";

/**
 * One participant's photobooth. The server state decides the screen:
 *   AWAITING_PAYMENT → PAID (camera check · invite · design · 7-day notice · waiting)
 *   → IN_PROGRESS (ready → countdown → review, ×4) → GENERATING → COMPLETED
 */
export function BoothApp({ sessionId, justPaid, cancelled }: { sessionId: string; justPaid: boolean; cancelled: boolean }) {
  const booth = useBooth(sessionId);
  const camera = useCamera();
  const [away, setAway] = useState(false);
  const { state, token } = booth;

  // Camera on while it's needed, off otherwise (never left running in the background).
  const needsCamera = !away && (state?.status === "PAID" || state?.status === "IN_PROGRESS");
  const autoStart = needsCamera && (state?.me.cameraReady || state?.status === "IN_PROGRESS");
  const { start, stop, status: camStatus } = camera;
  useEffect(() => {
    if (autoStart && camStatus === "idle") void start();
    if (!needsCamera && camStatus === "ready") stop();
  }, [autoStart, needsCamera, camStatus, start, stop]);

  if (token === undefined) return <Shell><Loading /></Shell>;
  if (token === null) return <Shell><NoLink /></Shell>;
  if (booth.loadError) return <Shell><LoadError error={booth.loadError} onRetry={() => void booth.refresh()} /></Shell>;
  if (!state) return <Shell><Loading /></Shell>;

  const myLink = ownLink(sessionId, token);
  const leave = () => {
    if (!window.confirm("Leave the photobooth? It stays saved — come back anytime with your private link.")) return;
    camera.stop();
    setAway(true);
  };

  if (away) {
    return (
      <Shell>
        <AwayScreen myLink={myLink} onBack={() => setAway(false)} />
      </Shell>
    );
  }

  const canLeave = state.status === "PAID" || state.status === "IN_PROGRESS";
  return (
    <Shell onLeave={canLeave ? leave : undefined} offline={booth.offline}>
      <InAppBrowserNotice
        surpriseId={sessionId}
        link={() => myLink}
        message="The camera may not work in this built-in browser."
      />
      <Screen booth={booth} state={state} camera={camera} myLink={myLink} sessionId={sessionId} token={token} justPaid={justPaid} cancelled={cancelled} onAway={() => {
        camera.stop();
        setAway(true);
      }} />
    </Shell>
  );
}

type Booth = ReturnType<typeof useBooth>;

function Screen(props: {
  booth: Booth;
  state: BoothState;
  camera: Camera;
  myLink: string;
  sessionId: string;
  token: string;
  justPaid: boolean;
  cancelled: boolean;
  onAway: () => void;
}) {
  const { state } = props;
  switch (state.status) {
    case "AWAITING_PAYMENT":
      return <PaymentScreen {...props} />;
    case "PAID":
      return <Lobby {...props} />;
    case "IN_PROGRESS":
      return <Rounds {...props} />;
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

// ─── Payment (Person A only; Person B never pays) ───────────────────────────

function PaymentScreen({ state, sessionId, token, justPaid, cancelled }: { state: BoothState; sessionId: string; token: string; justPaid: boolean; cancelled: boolean }) {
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

// ─── Lobby: camera check → invite → design → 7-day notice → waiting ─────────

function Lobby({ booth, state, camera, myLink, onAway }: { booth: Booth; state: BoothState; camera: Camera; myLink: string; onAway: () => void }) {
  const { me, partner } = state;
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
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

  // Step 1 — camera check (after payment, before anything else).
  if (!me.cameraReady) {
    if (camera.status === "error" && camera.issue) {
      return <CameraTrouble paid={state.me.role === "A"} issue={camera.issue} onRetry={retryCamera} retrying={false} myLink={myLink} onLater={onAway} />;
    }
    return (
      <div className="space-y-5">
        <div className="text-center">
          <h1 className="font-display text-3xl">Let&rsquo;s make sure your camera works.</h1>
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

  const frameId = state.frameId ?? DEFAULT_FRAME_ID;
  const waitingFor = !partner.joined
    ? "Waiting for your person…"
    : !partner.cameraReady
      ? "Waiting for them to enable their camera…"
      : !partner.acknowledged
        ? "Waiting for them to read the photo notice…"
        : "Your person is ready ❤️";

  return (
    <div className="space-y-4">
      {camera.status === "error" && camera.issue ? (
        <CameraTrouble paid={state.me.role === "A"} issue={camera.issue} onRetry={retryCamera} retrying={false} myLink={myLink} onLater={onAway} />
      ) : (
        <div className="mx-auto w-40">
          <CameraView camera={camera} />
        </div>
      )}

      <Card>
        <PartnerStatus partner={partner} waitingFor={waitingFor} />
      </Card>

      {me.role === "A" && state.inviteLink && <InviteCard link={state.inviteLink} joined={partner.joined} />}

      <Card>
        <h2 className="font-display text-xl">Choose your photobooth</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FRAMES.map((f) => {
            const selected = f.id === frameId;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  if (state.frameId !== f.id) void send({ frameId: f.id });
                }}
                aria-pressed={selected}
                className={`rounded-2xl bg-white p-3 text-left transition ${selected ? "ring-2 ring-rose" : "ring-1 ring-line hover:ring-ink/30"}`}
              >
                <img src={f.preview} alt="" className="mx-auto h-44 w-auto rounded-md shadow-md" />
                <span className="mt-2 block text-sm font-medium">{f.name}</span>
                <span className="block text-xs text-ink-soft">{selected ? "Selected ✓" : f.description}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-xl">Your photos are temporary.</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Once your photobooth is completed, your photos and photobooth strip will be available for {PHOTOBOOTH_RETENTION_DAYS} days. After that,
          they will be <strong className="text-ink">permanently deleted</strong>. Download your photos before they expire.
        </p>
        {me.acknowledged ? (
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-700">
            <Icon.check size={16} /> You understand your photos will be deleted after {PHOTOBOOTH_RETENTION_DAYS} days.
          </p>
        ) : (
          <>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3 text-sm ring-1 ring-line">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-rose" />
              <span>I understand that my photos will be deleted after {PHOTOBOOTH_RETENTION_DAYS} days.</span>
            </label>
            <Button className="mt-3 w-full" disabled={!agree} busy={busy} onClick={() => void send({ acknowledge: true, ...(state.frameId ? {} : { frameId }) })}>
              Continue
            </Button>
          </>
        )}
      </Card>
      {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
      <SupportLine />
    </div>
  );
}

function InviteCard({ link, joined }: { link: string; joined: boolean }) {
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
            onClick={() => void navigator.share({ title: "Our photobooth", text: "Join me in our little photobooth ❤️", url: link }).catch(() => undefined)}
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

function Rounds({ booth, state, camera, myLink, sessionId, token, onAway }: { booth: Booth; state: BoothState; camera: Camera; myLink: string; sessionId: string; token: string; onAway: () => void }) {
  const { me, partner, phase, attempt, round } = state;
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shotFor = useRef<number | null>(null);

  const ready = async () => {
    setBusy(true);
    setError(null);
    try {
      await booth.act("/ready", { attempt });
    } catch (err) {
      if (!(err instanceof ClientApiError && err.code === "BOOTH_STALE")) setError("Something went wrong. Please tap again.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: "KEEP" | "RETAKE") => {
    setBusy(true);
    setError(null);
    try {
      await booth.act("/decide", { attempt, decision });
    } catch (err) {
      if (!(err instanceof ClientApiError && err.code === "BOOTH_STALE")) setError("Something went wrong. Please tap again.");
    } finally {
      setBusy(false);
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

  const done = round - 1;
  const partnerAway = partner.joined && !partner.connected;
  const longAway = partnerAway && (partner.awayMs ?? 0) > RECONNECT_WINDOW_MS;

  return (
    <div className="space-y-4">
      <Progress round={round} done={done} />

      {state.notice && phase === "READY" && (
        <p className={`rounded-2xl bg-petal px-4 py-3 text-center text-sm ${s.enter}`}>
          {state.notice.kind === "aborted"
            ? "That one didn't go through — let's try again ❤️"
            : state.notice.by === "partner"
              ? "Your person wants another take. Let's try that one again ❤️"
              : "Let's try that one again ❤️"}
        </p>
      )}

      {partnerAway && (
        <Card className="text-center">
          <PartnerStatus partner={partner} />
          {longAway && (
            <p className="mt-2 text-xs text-ink-soft">
              They&rsquo;ve been away for a while. Your photobooth is saved — you can both come back later with your links.
            </p>
          )}
        </Card>
      )}

      {camera.status === "error" && camera.issue && <CameraTrouble paid={state.me.role === "A"} issue={camera.issue} onRetry={() => void camera.start()} retrying={false} myLink={myLink} onLater={onAway} />}

      {phase === "REVIEW" && state.review ? (
        <Card className={s.enter}>
          <div className="grid grid-cols-2 gap-3">
            <figure className="m-0">
              <img src={state.review.mine} alt="Your photo" className="aspect-[3/4] w-full rounded-2xl object-cover shadow-md" />
              <figcaption className="mt-1.5 text-center text-xs font-medium text-ink-soft">You</figcaption>
            </figure>
            <figure className="m-0">
              <img src={state.review.theirs} alt="Your person's photo" className="aspect-[3/4] w-full rounded-2xl object-cover shadow-md" />
              <figcaption className="mt-1.5 text-center text-xs font-medium text-ink-soft">Your person</figcaption>
            </figure>
          </div>
          {me.decision ? (
            <p className="mt-4 text-center text-sm text-ink-soft">
              {me.decision === "KEEP" ? "You kept this one ✓ " : ""}
              {partner.decision ? "" : "Waiting for your person…"}
            </p>
          ) : (
            <>
              <p className="mt-4 text-center font-display text-xl">Do you like this one?</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Button variant="secondary" className="py-4" disabled={busy} onClick={() => void decide("RETAKE")}>
                  Retake
                </Button>
                <Button className="py-4" disabled={busy} onClick={() => void decide("KEEP")}>
                  Keep ❤️
                </Button>
              </div>
              <p className="mt-2 text-center text-xs text-ink-soft">You both need to keep it. If either of you wants a retake, you both retake it.</p>
            </>
          )}
        </Card>
      ) : (
        <>
          <CameraView camera={camera}>
            {phase === "COUNTDOWN" && state.captureAt && !me.uploaded && <Countdown captureAt={state.captureAt} serverNow={booth.serverNow} onCapture={() => void onCapture()} />}
            {phase === "COUNTDOWN" && (me.uploaded || saving) && (
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/50 px-4 py-3 text-center text-sm text-white backdrop-blur">
                {saving && !me.uploaded ? "Saving your photo…" : "Got it! Waiting for your person's photo…"}
              </div>
            )}
          </CameraView>
          {phase === "READY" && (
            <div className="space-y-2">
              <p className="text-center font-display text-xl">Get ready.</p>
              {me.ready ? (
                <p className="rounded-full bg-white py-3 text-center text-sm font-medium ring-1 ring-line">
                  {partner.ready ? "Here we go!" : "You're ready ✓ — waiting for your person…"}
                </p>
              ) : (
                <Button className="w-full py-4 text-base" busy={busy} disabled={camera.status !== "ready"} onClick={() => void ready()}>
                  I&rsquo;m Ready
                </Button>
              )}
              {!me.ready && partner.ready && <p className="text-center text-sm text-ink-soft">Your person is ready!</p>}
            </div>
          )}
        </>
      )}
      {error && <p role="alert" className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}

// ─── After the fourth photo ─────────────────────────────────────────────────

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
  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">
          You made a little memory together. <HeartIcon size={24} className="inline text-rose" />
        </h1>
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
              <span className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-ink-soft group-hover:text-rose">
                Photo {p.round} · Download
              </span>
            </a>
          ))}
        </div>
      </Card>
      <div className="rounded-2xl bg-ink px-5 py-4 text-cream">
        <p className="font-medium">Available until {until}</p>
        <p className="mt-1 text-sm text-cream/75">
          Your photos will be permanently deleted after this date. Downloading doesn&rsquo;t extend it — save them now.
        </p>
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
      <p className="mt-2 text-ink-soft">
        This photobooth opens with the private link you were sent. Open that exact link (it ends with a long code) on this device.
      </p>
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

function Shell({ children, onLeave, offline }: { children: React.ReactNode; onLeave?: () => void; offline?: boolean }) {
  return (
    <div className="min-h-svh bg-[radial-gradient(80%_50%_at_50%_0%,#f9e2e7,transparent_70%)]">
      <header className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
        <Logo className="text-lg" />
        {onLeave && (
          <button type="button" onClick={onLeave} className="rounded-full px-3 py-2 text-sm text-ink-soft hover:bg-white/70 hover:text-ink">
            Leave photobooth
          </button>
        )}
      </header>
      {offline && (
        <p className="mx-auto mb-2 max-w-xl px-4 text-center text-xs text-ink-soft" role="status">
          Reconnecting… your photobooth is safe.
        </p>
      )}
      <main className="mx-auto max-w-xl px-4 pb-16 pt-2">{children}</main>
    </div>
  );
}
