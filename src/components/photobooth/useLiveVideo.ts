"use client";

import { useEffect, useMemo, useState } from "react";
import { boothApi } from "@/lib/photobooth/client";
import type { BoothRole, RtcSignal } from "@/lib/photobooth/types";

export type LiveStatus = "off" | "connecting" | "connected" | "unavailable";

const PREVIEW_ENCODING = { maxBitrate: 700_000, scaleResolutionDownBy: 2 };
const GATHER_TIMEOUT_MS = 4000;
const MAX_TRIES = 4;

/**
 * The live view between the two browsers (WebRTC). Video only — no sound — sent directly
 * and encrypted; a Cloudflare relay passes the encrypted stream along when phones can't
 * reach each other directly. Nothing is recorded or stored.
 *
 * Signalling is tiny: Person A posts one offer, Person B one answer, each already holding
 * every connection candidate (non-trickle ICE). If B reloads it posts a "request" and A
 * offers again; if the link fails A starts over. After a few failed tries it gives up
 * quietly — taking photos works exactly the same without the live view.
 */
class LiveLink {
  private pc: RTCPeerConnection | null = null;
  private stream: MediaStream | null = null;
  private ice: RTCIceServer[] | null = null;
  private epoch: string | null = null; // A: current offer · B: offer we answered
  private handledRequest: string | null = null;
  private tries = 0;
  private timer: number | undefined;
  private active = false;

  constructor(
    private readonly role: BoothRole,
    private readonly api: {
      ice: () => Promise<RTCIceServer[]>;
      send: (s: RtcSignal) => Promise<void>;
    },
    private readonly onStatus: (s: LiveStatus) => void,
    private readonly onRemote: (s: MediaStream | null) => void,
  ) {}

  start() {
    this.active = true;
    this.tries = 0;
    this.onStatus("connecting");
    if (this.role === "A") void this.offer();
    else void this.api.send({ type: "request", epoch: crypto.randomUUID() }); // "I'm here — send me an offer"
  }

  stop() {
    this.active = false;
    window.clearTimeout(this.timer);
    this.pc?.close();
    this.pc = null;
    this.onRemote(null);
  }

  /** Camera (re)started: swap the outgoing track without renegotiating. */
  setStream(stream: MediaStream | null) {
    this.stream = stream;
    const track = stream?.getVideoTracks()[0];
    const sender = this.pc?.getTransceivers().find((t) => t.receiver.track.kind === "video")?.sender;
    if (track && sender && sender.track !== track) void sender.replaceTrack(track).catch(() => undefined);
  }

  handleSignal(signal: RtcSignal) {
    if (!this.active) return;
    if (this.role === "A") {
      if (signal.type === "answer" && signal.epoch === this.epoch && this.pc?.signalingState === "have-local-offer") {
        void this.pc.setRemoteDescription({ type: "answer", sdp: signal.sdp ?? "" }).catch(() => this.failed());
      } else if (signal.type === "request" && signal.epoch !== this.handledRequest) {
        this.handledRequest = signal.epoch;
        this.tries = 0;
        void this.offer();
      }
    } else if (signal.type === "offer" && signal.epoch !== this.epoch) {
      void this.answer(signal).catch(() => this.failed());
    }
  }

  private async servers() {
    if (!this.ice) this.ice = await this.api.ice().catch(() => [{ urls: "stun:stun.cloudflare.com:3478" }]);
    return this.ice;
  }

  private async connection(): Promise<RTCPeerConnection> {
    this.pc?.close();
    const conn = new RTCPeerConnection({ iceServers: await this.servers() });
    this.pc = conn;
    conn.ontrack = (e) => this.onRemote(e.streams[0] ?? new MediaStream([e.track]));
    conn.onconnectionstatechange = () => {
      if (this.pc !== conn) return;
      if (conn.connectionState === "connected") {
        this.tries = 0;
        this.onStatus("connected");
      } else if (conn.connectionState === "failed") {
        this.failed();
      } else if (conn.connectionState === "disconnected") {
        // Usually recovers by itself; if not within a few seconds, start over.
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => this.pc === conn && conn.connectionState !== "connected" && this.failed(), 6000);
      }
    };
    return conn;
  }

  /** Wait for every candidate (direct + relay) so one message carries everything. */
  private gathered(conn: RTCPeerConnection) {
    return new Promise<void>((resolve) => {
      if (conn.iceGatheringState === "complete") return resolve();
      const done = () => {
        conn.removeEventListener("icegatheringstatechange", check);
        resolve();
      };
      const check = () => conn.iceGatheringState === "complete" && done();
      conn.addEventListener("icegatheringstatechange", check);
      window.setTimeout(done, GATHER_TIMEOUT_MS);
    });
  }

  private failed() {
    if (!this.active) return;
    this.onStatus("connecting");
    if (this.role === "B") {
      // A drives retries; B just asks for a fresh offer.
      void this.api.send({ type: "request", epoch: crypto.randomUUID() });
      return;
    }
    this.tries++;
    if (this.tries >= MAX_TRIES) {
      this.pc?.close();
      this.pc = null;
      this.onStatus("unavailable");
      return;
    }
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.offer(), 1500 * this.tries);
  }

  private async offer() {
    if (!this.active) return;
    const conn = await this.connection();
    const track = this.stream?.getVideoTracks()[0];
    if (track) {
      try {
        conn.addTransceiver(track, { direction: "sendrecv", streams: [this.stream!], sendEncodings: [PREVIEW_ENCODING] });
      } catch {
        conn.addTrack(track, this.stream!);
      }
    } else {
      conn.addTransceiver("video", { direction: "recvonly" });
    }
    const id = crypto.randomUUID();
    this.epoch = id;
    await conn.setLocalDescription(await conn.createOffer());
    await this.gathered(conn);
    if (this.pc !== conn || !this.active) return;
    await this.api.send({ type: "offer", sdp: conn.localDescription?.sdp ?? "", epoch: id });
  }

  private async answer(signal: RtcSignal) {
    const conn = await this.connection();
    this.epoch = signal.epoch;
    await conn.setRemoteDescription({ type: "offer", sdp: signal.sdp ?? "" });
    const track = this.stream?.getVideoTracks()[0];
    const transceiver = conn.getTransceivers().find((t) => t.receiver.track.kind === "video");
    if (track && transceiver) {
      await transceiver.sender.replaceTrack(track);
      transceiver.direction = "sendrecv";
    }
    await conn.setLocalDescription(await conn.createAnswer());
    await this.gathered(conn);
    if (this.pc !== conn || !this.active) return;
    // Lighter encoding for a preview (best effort — some browsers refuse before connecting).
    try {
      const sender = transceiver?.sender;
      const params = sender?.getParameters();
      if (sender && params?.encodings?.[0]) {
        Object.assign(params.encodings[0], PREVIEW_ENCODING);
        await sender.setParameters(params);
      }
    } catch {
      // full-quality preview is fine too
    }
    await this.api.send({ type: "answer", sdp: conn.localDescription?.sdp ?? "", epoch: signal.epoch });
  }
}

export function useLiveVideo({
  sessionId,
  token,
  role,
  enabled,
  stream,
  partnerSignal,
}: {
  sessionId: string;
  token: string;
  role: BoothRole;
  enabled: boolean;
  stream: MediaStream | null;
  partnerSignal: RtcSignal | null;
}) {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const supported = typeof window !== "undefined" && typeof window.RTCPeerConnection === "function";

  const link = useMemo(
    () =>
      new LiveLink(
        role,
        {
          ice: async () => (await boothApi<{ iceServers: RTCIceServer[] }>(sessionId, token, "/ice", { retries: 2 })).iceServers,
          send: async (signal) => {
            await boothApi(sessionId, token, "/signal", { method: "POST", body: signal, retries: 2 }).catch(() => undefined);
          },
        },
        setStatus,
        setRemote,
      ),
    [sessionId, token, role],
  );

  const ready = supported && enabled && Boolean(stream);

  useEffect(() => {
    link.setStream(stream);
  }, [link, stream]);

  useEffect(() => {
    if (!ready) return;
    link.start();
    return () => link.stop();
  }, [link, ready]);

  const sigKey = partnerSignal ? `${partnerSignal.type}:${partnerSignal.epoch}` : "";
  useEffect(() => {
    if (ready && partnerSignal) link.handleSignal(partnerSignal);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react once per distinct signal
  }, [link, ready, sigKey]);

  if (!supported && enabled) return { status: "unavailable" as LiveStatus, remote: null };
  return { status: ready ? status : ("off" as LiveStatus), remote: ready ? remote : null };
}
