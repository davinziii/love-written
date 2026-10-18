/**
 * Pixel Heart Hunt — the game itself, with no React and no drawing.
 *
 * Everything lives in a fixed logical world: WORLD_H units tall and `w` units wide (the
 * width follows the screen's shape, clamped), so hit tests stay exact however the canvas is
 * scaled. The launcher sits at the bottom center; hearts float in the upper part. `update(dt)`
 * advances by real seconds (delta time), so the speed is the same at 30, 60 or 120 fps.
 */

export const WORLD_H = 560;
export const MIN_W = 300;
export const MAX_W = 1000;

export const HEART_PX = 3; // logical units per sprite pixel
export const HEART_R = 19; // a 13 × 12 sprite at 3 units ≈ 39 × 36
const HIT_R = HEART_R + 11; // forgiving: the arrow only has to come close
const MIN_GAP = HEART_R * 2 + 30; // between heart centers when spawning

export const LAUNCHER_Y_OFFSET = 52; // from the bottom
export const MAX_AIM = (72 * Math.PI) / 180; // either side of straight up
const AIM_SPEED = 1.9; // radians per second while a button is held
const ARROW_SPEED = 640;
const MAX_ARROWS = 6;
const FIRE_EVERY = 0.24; // seconds between shots while the shoot button is held
const ASSIST_PATH = 46; // a heart this close to the aim line gets the shot…
const ASSIST_MAX = (7 * Math.PI) / 180; // …by turning the arrow at most this much

export const POP_S = 0.46;
const BURST_AT = 0.16;
const PARTICLES_PER_POP = 9;
const MAX_PARTICLES = 90;

export type Heart = {
  id: number;
  x: number;
  y: number;
  /** Bobbing phase, so hearts don't float in step. */
  phase: number;
  /** Seconds since it was hit; null while alive. */
  popT: number | null;
  /** Fades in when it spawns (endless mode). */
  age: number;
};
export type Arrow = { x: number; y: number; vx: number; vy: number };
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; kind: "heart" | "dot"; size: number };

export type GameEvent = { type: "hit"; heartId: number } | { type: "popped"; heartId: number } | { type: "shot" };

export type Mode = "story" | "endless";

export const STORY_HEARTS = 5;
export const endlessHeartCount = (w: number) => (w < 520 ? 6 : 10);

export function worldWidth(displayW: number, displayH: number): number {
  if (!(displayW > 0 && displayH > 0)) return 360;
  return Math.round(Math.min(MAX_W, Math.max(MIN_W, (WORLD_H * displayW) / displayH)));
}

/** Where hearts may appear: inside the scene, above the launcher, reachable within the aim range. */
export function spawnArea(w: number) {
  return { minX: HEART_R + 12, maxX: w - HEART_R - 12, minY: 70, maxY: Math.round(WORLD_H * 0.6) };
}

export function launcher(w: number) {
  return { x: w / 2, y: WORLD_H - LAUNCHER_Y_OFFSET };
}

/** Can a straight arrow from the launcher reach (x, y) without aiming past the limit? */
export function reachable(w: number, x: number, y: number): boolean {
  const l = launcher(w);
  const dy = l.y - y;
  if (dy <= 0) return false;
  return Math.abs(Math.atan2(x - l.x, dy)) <= MAX_AIM - 0.06;
}

/**
 * Picks `count` positions that don't overlap each other or `taken`, stay inside the spawn
 * area and are reachable. Falls back to a smaller gap if the screen is crowded.
 */
export function spawnPositions(count: number, w: number, taken: readonly { x: number; y: number }[], rand: () => number = Math.random) {
  const area = spawnArea(w);
  const placed: { x: number; y: number }[] = [];
  let gap = MIN_GAP;
  for (let n = 0; n < count; n++) {
    let spot: { x: number; y: number } | null = null;
    for (let tries = 0; !spot; tries++) {
      if (tries > 0 && tries % 120 === 0) gap = Math.max(HEART_R * 2 + 4, gap * 0.85);
      const x = area.minX + rand() * (area.maxX - area.minX);
      const y = area.minY + rand() * (area.maxY - area.minY);
      if (!reachable(w, x, y) && tries < 4000) continue;
      const clear = [...taken, ...placed].every((p) => Math.hypot(p.x - x, p.y - y) >= gap);
      if (clear || tries > 2000) spot = { x: Math.round(x), y: Math.round(y) };
    }
    placed.push(spot);
  }
  return placed;
}

export class HeartHuntEngine {
  w = 360;
  mode: Mode = "story";
  hearts: Heart[] = [];
  arrows: Arrow[] = [];
  particles: Particle[] = [];
  /** 0 = straight up; negative = left. */
  angle = 0;
  time = 0;
  /** -1, 0 or 1 while an aim button / key is held. */
  aimDir = 0;
  shootHeld = false;
  /** Story mode: after a hit, no more shots until the photo has been shown. */
  locked = false;
  private cooldown = 0;
  private nextId = 1;
  private sized = false;

  constructor(private rand: () => number = Math.random) {}

  /** First call places the five hearts; later calls keep them in place, stretched to the new width. */
  resize(w: number) {
    if (!this.sized) {
      this.w = w;
      this.sized = true;
      this.hearts = this.makeHearts(STORY_HEARTS, []);
      return;
    }
    if (w === this.w) return;
    const k = w / this.w;
    for (const h of this.hearts) h.x *= k;
    for (const a of this.arrows) a.x *= k;
    for (const p of this.particles) p.x *= k;
    this.w = w;
  }

  /** Switch to endless mode: a steady number of hearts, a new one for every heart popped. */
  startEndless() {
    this.mode = "endless";
    this.locked = false;
    this.arrows = [];
    const want = endlessHeartCount(this.w);
    const alive = this.hearts.filter((h) => h.popT === null);
    this.hearts = [...alive, ...this.makeHearts(Math.max(0, want - alive.length), alive)];
  }

  unlock() {
    this.locked = false;
    this.cooldown = 0;
  }

  aimBy(radians: number) {
    this.angle = clampAim(this.angle + radians);
  }

  /** Point the bow at a spot (tap-to-target) — the arrow still has to fly there. */
  aimAt(x: number, y: number) {
    const l = launcher(this.w);
    this.angle = clampAim(Math.atan2(x - l.x, Math.max(1, l.y - y)));
  }

  /** Fire one arrow if allowed. Returns whether it fired. */
  shoot(): boolean {
    if (this.locked || this.cooldown > 0 || this.arrows.length >= MAX_ARROWS) return false;
    const l = launcher(this.w);
    const tip = 40;
    const dir = this.assist(this.angle);
    this.arrows.push({
      x: l.x + Math.sin(this.angle) * tip,
      y: l.y - Math.cos(this.angle) * tip,
      vx: Math.sin(dir) * ARROW_SPEED,
      vy: -Math.cos(dir) * ARROW_SPEED,
    });
    this.cooldown = FIRE_EVERY;
    return true;
  }

  update(dtRaw: number, reducedMotion = false): GameEvent[] {
    // A long pause (tab switch, slow frame) must not teleport arrows through hearts.
    const dt = Math.min(dtRaw, 1 / 20);
    const events: GameEvent[] = [];
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.aimDir) this.aimBy(this.aimDir * AIM_SPEED * dt);
    if (this.shootHeld && this.shoot()) events.push({ type: "shot" });

    for (const h of this.hearts) h.age += dt;

    // Arrows: move in small steps so a fast arrow can't skip over a heart.
    const steps = Math.max(1, Math.ceil((ARROW_SPEED * dt) / 12));
    const sdt = dt / steps;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i]!;
      let hit: Heart | null = null;
      for (let s = 0; s < steps && !hit; s++) {
        a.x += a.vx * sdt;
        a.y += a.vy * sdt;
        hit = this.hearts.find((h) => h.popT === null && h.age > 0.25 && Math.hypot(h.x - a.x, this.bobY(h, reducedMotion) - a.y) < HIT_R) ?? null;
      }
      if (hit) {
        hit.popT = 0;
        this.arrows.splice(i, 1);
        events.push({ type: "hit", heartId: hit.id });
        if (this.mode === "story") {
          // One photo at a time: the other arrows vanish and the bow waits for the photo.
          this.locked = true;
          this.arrows = [];
          break;
        }
        continue;
      }
      if (a.y < -40 || a.x < -40 || a.x > this.w + 40 || a.y > WORLD_H + 40) this.arrows.splice(i, 1);
    }

    // Popping hearts: squash, stretch, burst, gone.
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i]!;
      if (h.popT === null) continue;
      const before = h.popT;
      h.popT += dt;
      if (before < BURST_AT && h.popT >= BURST_AT) this.burst(h.x, this.bobY(h, reducedMotion));
      if (h.popT >= POP_S) {
        this.hearts.splice(i, 1);
        events.push({ type: "popped", heartId: h.id });
        if (this.mode === "endless") this.hearts.push(...this.makeHearts(1, this.hearts));
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life += dt;
      if (p.life >= p.max) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt; // a little gravity
      p.vx *= 1 - 1.8 * dt;
    }
    return events;
  }

  /** A heart's drawn height, bobbing gently (whole units, so it moves like pixel art). */
  bobY(h: Heart, reducedMotion = false): number {
    if (reducedMotion) return h.y;
    return h.y + Math.round(Math.sin(this.time * 1.7 + h.phase) * 3);
  }

  aliveCount() {
    return this.hearts.filter((h) => h.popT === null).length;
  }

  /**
   * Aim assist, decided once when the arrow leaves (so it never bends mid-air toward a
   * different heart): the heart nearest the aim line, if it's close, gets a slightly corrected shot.
   */
  private assist(angle: number): number {
    const l = launcher(this.w);
    const ux = Math.sin(angle);
    const uy = -Math.cos(angle);
    let best: number | null = null;
    let bestOff = ASSIST_PATH;
    for (const h of this.hearts) {
      if (h.popT !== null) continue;
      const dx = h.x - l.x;
      const dy = h.y - l.y;
      if (dx * ux + dy * uy <= 0) continue; // behind the bow
      const off = Math.abs(dx * uy - dy * ux); // distance from the aim line
      if (off < bestOff) {
        bestOff = off;
        best = Math.atan2(dx, -dy);
      }
    }
    if (best === null) return angle;
    return angle + Math.max(-ASSIST_MAX, Math.min(ASSIST_MAX, best - angle));
  }

  private burst(x: number, y: number) {
    for (let i = 0; i < PARTICLES_PER_POP; i++) {
      const dir = (i / PARTICLES_PER_POP) * Math.PI * 2 + this.rand() * 0.5;
      const speed = 90 + this.rand() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed - 60,
        life: 0,
        max: 0.45 + this.rand() * 0.3,
        kind: i % 2 === 0 ? "heart" : "dot",
        size: i % 3 === 0 ? 3 : 2,
      });
    }
    // Never let particles pile up, however fast someone pops hearts.
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
  }

  private makeHearts(count: number, taken: readonly { x: number; y: number }[]): Heart[] {
    return spawnPositions(count, this.w, taken, this.rand).map((p) => ({
      id: this.nextId++,
      x: p.x,
      y: p.y,
      phase: this.rand() * Math.PI * 2,
      popT: null,
      age: this.mode === "endless" ? 0 : 1,
    }));
  }
}

function clampAim(a: number) {
  return Math.max(-MAX_AIM, Math.min(MAX_AIM, a));
}
