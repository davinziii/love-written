/**
 * Pixel Heart Hunt — hand-made pixel sprites and the canvas painter.
 *
 * Sprites are tiny bitmaps written as strings (one character = one pixel) and baked once per
 * palette into offscreen canvases; every frame then only copies them with smoothing off, which
 * keeps it crisp and cheap on older phones.
 */
import type { Palette } from "./definition";
import { HEART_PX, POP_S, WORLD_H, launcher, type HeartHuntEngine } from "./engine";

type Bitmap = readonly string[];

// o outline · h heart · w shine · s shade
export const HEART: Bitmap = [
  "..ooo...ooo..",
  ".ohhho.ohhho.",
  "ohwwhhohhhhho",
  "ohwhhhhhhhhho",
  "ohhhhhhhhhhho",
  "ohhhhhhhhhhso",
  ".ohhhhhhhhso.",
  "..ohhhhhhso..",
  "...ohhhhso...",
  "....ohhso....",
  ".....oso.....",
  "......o......",
];

const MINI_HEART: Bitmap = [".h.h.", "hhhhh", "hhhhh", ".hhh.", "..h.."];

// c cloud · d cloud shade
const CLOUD: Bitmap = [
  ".....cccc.......",
  "...cccccccc.cc..",
  ".cccccccccccccc.",
  "cccccccccccccccc",
  "cccccccccccccccc",
  ".dddddddddddddd.",
];

// a arrowhead · s shaft · b bow · t string · f feather
const BOW: Bitmap = [
  ".....a.....",
  "....aaa....",
  "...aaaaa...",
  ".....s.....",
  "..bbbsbbb..",
  ".bb..s..bb.",
  "bb...s...bb",
  "b....s....b",
  "b....s....b",
  "t....s....t",
  ".t...s...t.",
  "..t..s..t..",
  "...tfsft...",
  "....fff....",
  ".....f.....",
];
const BOW_PX = 4;
/** Where the bow turns around: the grip, in sprite pixels. */
const BOW_PIVOT = { x: 5.5, y: 6.5 };

// A little cloud for the bow to stand on.
const STAND: Bitmap = [
  "....cccc....cc....",
  "..cccccccccccccc..",
  ".cccccccccccccccc.",
  "cccccccccccccccccc",
  ".dddddddddddddddd.",
];

function bake(bitmap: Bitmap, colors: Record<string, string>, px: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = bitmap[0]!.length * px;
  c.height = bitmap.length * px;
  const ctx = c.getContext("2d")!;
  bitmap.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = colors[row[x]!];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * px, y * px, px, px);
    }
  });
  return c;
}

type Sheet = {
  heart: HTMLCanvasElement;
  heartWhite: HTMLCanvasElement;
  mini: HTMLCanvasElement;
  dot: string;
  cloud: HTMLCanvasElement;
  bow: HTMLCanvasElement;
  stand: HTMLCanvasElement;
};

const sheets = new Map<string, Sheet>();

function sheetFor(p: Palette): Sheet {
  const key = Object.values(p).join();
  let s = sheets.get(key);
  if (!s) {
    s = {
      heart: bake(HEART, { o: p.heartDark, h: p.heart, w: p.cream, s: p.heartDark }, HEART_PX),
      heartWhite: bake(HEART, { o: p.cream, h: p.cream, w: p.cream, s: p.cream }, HEART_PX),
      mini: bake(MINI_HEART, { h: p.heart }, 1),
      dot: p.soft,
      cloud: bake(CLOUD, { c: p.cream, d: p.soft }, 4),
      bow: bake(BOW, { a: p.ink, s: p.ink, b: p.heartDark, t: p.cream, f: p.heart }, BOW_PX),
      stand: bake(STAND, { c: p.cream, d: p.soft }, 4),
    };
    sheets.set(key, s);
  }
  return s;
}

/** Fixed scenery for one world width: drifting clouds and twinkling stars, from a seed. */
export type Scenery = { clouds: { x: number; y: number; speed: number; scale: number }[]; stars: { x: number; y: number; phase: number }[] };

export function makeScenery(w: number, seed = 7): Scenery {
  let n = seed;
  const r = () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
  const count = w < 520 ? 4 : 6;
  const clouds = Array.from({ length: count }, (_, i) => ({
    x: (i / count) * (w + 120) - 60 + r() * 40,
    y: 40 + r() * (WORLD_H * 0.62),
    speed: 4 + r() * 6,
    scale: r() < 0.4 ? 2 : 1,
  }));
  const stars = Array.from({ length: w < 520 ? 12 : 20 }, () => ({ x: r() * w, y: 20 + r() * (WORLD_H * 0.7), phase: r() * Math.PI * 2 }));
  return { clouds, stars };
}

export type View = { scale: number; offsetX: number; offsetY: number; dpr: number };

/** Paint one frame. `t` is seconds of scene time (clouds keep drifting even while paused). */
export function paint(ctx: CanvasRenderingContext2D, game: HeartHuntEngine, palette: Palette, scenery: Scenery, view: View, t: number, opts: { reducedMotion: boolean; aimGuide: boolean }) {
  const s = sheetFor(palette);
  const { w } = game;
  const { scale, offsetX, offsetY, dpr } = view;
  const canvas = ctx.canvas;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offsetX * dpr, offsetY * dpr);

  // Sky: a stepped gradient (pixel bands rather than a smooth blend).
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    ctx.globalAlpha = (i / (bands - 1)) * 0.55;
    ctx.fillStyle = palette.bgLow;
    ctx.fillRect(-offsetX / scale, WORLD_H * 0.5 + (i * WORLD_H * 0.5) / bands, w + (offsetX * 2) / scale, (WORLD_H * 0.5) / bands + 1);
  }
  ctx.globalAlpha = 1;

  // Stars: tiny pixel plus-signs that twinkle.
  ctx.fillStyle = palette.star;
  for (const st of scenery.stars) {
    const a = opts.reducedMotion ? 0.7 : 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + st.phase));
    ctx.globalAlpha = a;
    const x = Math.round(st.x);
    const y = Math.round(st.y);
    ctx.fillRect(x, y, 2, 2);
    if (a > 0.75) {
      ctx.fillRect(x - 2, y, 2, 2);
      ctx.fillRect(x + 2, y, 2, 2);
      ctx.fillRect(x, y - 2, 2, 2);
      ctx.fillRect(x, y + 2, 2, 2);
    }
  }
  ctx.globalAlpha = 1;

  // Clouds drift slowly and wrap around.
  for (const c of scenery.clouds) {
    const cw = s.cloud.width * c.scale;
    const span = w + cw + 40;
    const x = opts.reducedMotion ? c.x : ((((c.x + t * c.speed) % span) + span) % span) - cw - 20;
    ctx.globalAlpha = c.scale === 2 ? 0.55 : 0.85;
    ctx.drawImage(s.cloud, Math.round(x), Math.round(c.y), cw, s.cloud.height * c.scale);
  }
  ctx.globalAlpha = 1;

  // Hearts.
  const hw = s.heart.width;
  const hh = s.heart.height;
  for (const h of game.hearts) {
    const y = game.bobY(h, opts.reducedMotion);
    if (h.popT === null) {
      const appear = Math.min(1, h.age / 0.3);
      const k = appear < 1 ? 0.5 + 0.5 * appear : 1;
      ctx.globalAlpha = appear;
      ctx.drawImage(s.heart, Math.round(h.x - (hw * k) / 2), Math.round(y - (hh * k) / 2), Math.round(hw * k), Math.round(hh * k));
      continue;
    }
    // Pop: squash (wide & short), stretch (bigger), then flash and vanish into the burst.
    const p = h.popT / POP_S;
    let sx = 1;
    let sy = 1;
    if (p < 0.2) {
      sx = 1.3;
      sy = 0.72;
    } else if (p < 0.38) {
      sx = sy = 1.28;
    } else {
      sx = sy = 1.28 + (p - 0.38) * 0.6;
    }
    ctx.globalAlpha = p < 0.38 ? 1 : Math.max(0, 1 - (p - 0.38) / 0.35);
    const img = p >= 0.28 && p < 0.5 ? s.heartWhite : s.heart;
    ctx.drawImage(img, Math.round(h.x - (hw * sx) / 2), Math.round(y - (hh * sy) / 2), Math.round(hw * sx), Math.round(hh * sy));
  }
  ctx.globalAlpha = 1;

  // Particles: tiny hearts and pink pixels that fade.
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
    if (p.kind === "heart") {
      const size = s.mini.width * p.size;
      ctx.drawImage(s.mini, Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
    } else {
      ctx.fillStyle = palette.heart;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size * 2, p.size * 2);
    }
  }
  ctx.globalAlpha = 1;

  // Arrows with a short pixel trail.
  for (const a of game.arrows) {
    const dir = Math.atan2(a.vy, a.vx);
    const ux = Math.cos(dir);
    const uy = Math.sin(dir);
    ctx.fillStyle = palette.heart;
    for (let i = 1; i <= 5; i++) {
      ctx.globalAlpha = 0.5 - i * 0.08;
      ctx.fillRect(Math.round(a.x - ux * (14 + i * 7)) - 1, Math.round(a.y - uy * (14 + i * 7)) - 1, 3, 3);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(Math.round(a.x), Math.round(a.y));
    ctx.rotate(dir + Math.PI / 2);
    ctx.fillStyle = palette.ink;
    ctx.fillRect(-1, -2, 2, 16); // shaft
    ctx.fillRect(-3, -2, 6, 2); // head
    ctx.fillRect(-1, -5, 2, 3);
    ctx.fillStyle = palette.heart;
    ctx.fillRect(-3, 12, 2, 4); // feathers
    ctx.fillRect(1, 12, 2, 4);
    ctx.restore();
  }

  // Aim guide: a short dotted pixel line where the arrow will go.
  const l = launcher(w);
  if (opts.aimGuide) {
    ctx.fillStyle = palette.heartDark;
    for (let i = 0; i < 7; i++) {
      const d = 46 + i * 18;
      ctx.globalAlpha = 0.55 - i * 0.07;
      ctx.fillRect(Math.round(l.x + Math.sin(game.angle) * d) - 2, Math.round(l.y - Math.cos(game.angle) * d) - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  // The bow on its little cloud.
  ctx.drawImage(s.stand, Math.round(l.x - s.stand.width / 2), Math.round(l.y + 14), s.stand.width, s.stand.height);
  ctx.save();
  ctx.translate(Math.round(l.x), Math.round(l.y));
  ctx.rotate(game.angle);
  ctx.drawImage(s.bow, -BOW_PIVOT.x * BOW_PX, -BOW_PIVOT.y * BOW_PX);
  ctx.restore();
}

