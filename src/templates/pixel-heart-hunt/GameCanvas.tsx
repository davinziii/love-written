"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Palette } from "./definition";
import { HeartHuntEngine, WORLD_H, worldWidth, type GameEvent } from "./engine";
import { makeScenery, paint, type Scenery, type View } from "./sprites";

/**
 * The play area: one canvas, one requestAnimationFrame loop.
 *
 * The loop only runs while `running` is true, the tab is visible and the canvas is on screen;
 * otherwise it paints a single still frame. The canvas maps the fixed logical world onto
 * whatever size it's shown at, so taps and hits stay exact when the phone toolbar moves.
 */
export function GameCanvas({
  engineRef,
  running,
  palette,
  aimGuide,
  onEvents,
}: {
  engineRef: RefObject<HeartHuntEngine | null>;
  running: boolean;
  palette: Palette;
  aimGuide: boolean;
  onEvents: (events: GameEvent[]) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ scale: 1, offsetX: 0, offsetY: 0, dpr: 1 });
  const scenery = useRef<Scenery>(makeScenery(360));
  const sceneT = useRef(0);
  const reduced = useRef(false);
  const latest = useRef({ palette, onEvents, aimGuide });
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    latest.current = { palette, onEvents, aimGuide };
  });

  const draw = () => {
    const canvas = canvasRef.current;
    const game = engineRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !game || !ctx) return;
    paint(ctx, game, latest.current.palette, scenery.current, view.current, sceneT.current, {
      reducedMotion: reduced.current,
      aimGuide: latest.current.aimGuide,
    });
  };
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });

  // Size the canvas to its box (sharp on retina, capped for slower phones) and fit the world in it.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    // A fresh game for every mount — the parent remounts this with a new key to reset.
    engineRef.current = new HeartHuntEngine();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = media.matches;
    const onMotion = () => (reduced.current = media.matches);
    media.addEventListener("change", onMotion);

    const fit = () => {
      const game = engineRef.current;
      const rect = wrap.getBoundingClientRect();
      if (!game || rect.width < 10 || rect.height < 10) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const before = game.w;
      game.resize(worldWidth(rect.width, rect.height));
      const scale = Math.min(rect.width / game.w, rect.height / WORLD_H);
      view.current = { scale, dpr, offsetX: (rect.width - game.w * scale) / 2, offsetY: rect.height - WORLD_H * scale };
      if (before !== game.w || scenery.current.stars.length === 0) scenery.current = makeScenery(game.w);
      drawRef.current();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    fit();

    const io = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)));
    io.observe(wrap);
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      ro.disconnect();
      io.disconnect();
      media.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVis);
      engineRef.current = null;
    };
  }, [engineRef]);

  // The game loop.
  const active = running && onScreen && tabVisible;
  useEffect(() => {
    const game = engineRef.current;
    if (!active || !game) {
      if (game) {
        game.aimDir = 0;
        game.shootHeld = false;
      }
      drawRef.current();
      return;
    }
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      sceneT.current += Math.min(dt, 0.1);
      const events = game.update(dt, reduced.current);
      if (events.length) latest.current.onEvents(events);
      drawRef.current();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, engineRef]);

  // A palette change (in the editor) repaints the still frame.
  useEffect(() => {
    if (!active) drawRef.current();
  }, [palette, active]);

  /** Tap-to-target: point the bow where they tapped and shoot — the arrow still has to fly. */
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const game = engineRef.current;
    if (!running || !game) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { scale, offsetX, offsetY } = view.current;
    game.aimAt((e.clientX - rect.left - offsetX) / scale, (e.clientY - rect.top - offsetY) / scale);
    if (game.shoot()) latest.current.onEvents([{ type: "shot" }]);
    drawRef.current();
  };

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        aria-hidden
        style={{ display: "block", width: "100%", height: "100%", imageRendering: "pixelated", touchAction: "none" }}
      />
    </div>
  );
}
