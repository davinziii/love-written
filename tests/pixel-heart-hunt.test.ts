import { describe, expect, it } from "vitest";
import {
  HEART_R,
  HeartHuntEngine,
  STORY_HEARTS,
  WORLD_H,
  endlessHeartCount,
  launcher,
  reachable,
  spawnArea,
  spawnPositions,
  worldWidth,
  type GameEvent,
} from "@/templates/pixel-heart-hunt/engine";
import { initialGame, reduce, type Action, type GameState } from "@/templates/pixel-heart-hunt/machine";

/** A repeatable random source, so a failure can be replayed. */
function seeded(seed: number) {
  let n = seed;
  return () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
}

/** Aim at a heart, shoot, and run the game until something happens (or give up). */
function shootAt(game: HeartHuntEngine, heartId: number, maxSeconds = 3): GameEvent[] {
  const h = game.hearts.find((x) => x.id === heartId)!;
  game.aimAt(h.x, h.y);
  expect(game.shoot()).toBe(true);
  const events: GameEvent[] = [];
  for (let t = 0; t < maxSeconds; t += 1 / 60) {
    events.push(...game.update(1 / 60, true));
    if (events.some((e) => e.type === "popped")) break;
  }
  return events;
}

describe("pixel heart hunt — spawning", () => {
  it("places five non-overlapping, reachable hearts inside the play area on many screen sizes", () => {
    for (const [dw, dh] of [
      [320, 480],
      [375, 620],
      [414, 700],
      [768, 820],
      [1280, 640],
      [1920, 700],
    ] as const) {
      const w = worldWidth(dw, dh);
      for (let seed = 1; seed <= 40; seed++) {
        const spots = spawnPositions(STORY_HEARTS, w, [], seeded(seed));
        const area = spawnArea(w);
        expect(spots).toHaveLength(STORY_HEARTS);
        for (const p of spots) {
          expect(p.x).toBeGreaterThanOrEqual(area.minX - 1);
          expect(p.x).toBeLessThanOrEqual(area.maxX + 1);
          expect(p.y).toBeGreaterThanOrEqual(area.minY - 1);
          expect(p.y).toBeLessThanOrEqual(area.maxY + 1);
          expect(reachable(w, p.x, p.y)).toBe(true);
          // Well above the bow and the controls.
          expect(p.y).toBeLessThan(launcher(w).y - 120);
        }
        for (let i = 0; i < spots.length; i++)
          for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.y - spots[j]!.y)).toBeGreaterThan(HEART_R * 2);
      }
    }
  });

  it("gives a different layout for a fresh game", () => {
    const a = spawnPositions(STORY_HEARTS, 360, [], seeded(1));
    const b = spawnPositions(STORY_HEARTS, 360, [], seeded(2));
    expect(a).not.toEqual(b);
  });

  it("keeps the world height fixed and the width within limits", () => {
    expect(worldWidth(320, 2000)).toBe(300);
    expect(worldWidth(5000, 400)).toBe(1000);
    expect(worldWidth(0, 0)).toBe(360);
    expect(WORLD_H).toBe(560);
  });
});

describe("pixel heart hunt — shooting", () => {
  it("every one of the five hearts can be hit, and each counts once", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const game = new HeartHuntEngine(seeded(seed));
      game.resize(worldWidth(375, 620));
      let hits = 0;
      while (game.hearts.length) {
        const events = shootAt(game, game.hearts[0]!.id);
        hits += events.filter((e) => e.type === "hit").length;
        expect(events.filter((e) => e.type === "popped")).toHaveLength(1);
        game.unlock();
      }
      expect(hits).toBe(STORY_HEARTS);
    }
  });

  it("forgives a slightly-off aim", () => {
    const game = new HeartHuntEngine(seeded(5));
    game.resize(360);
    const h = game.hearts[0]!;
    game.hearts = [h];
    const l = launcher(game.w);
    game.angle = Math.atan2(h.x - l.x, l.y - h.y) + 0.07; // ~4° off
    game.shoot();
    const events: GameEvent[] = [];
    for (let i = 0; i < 120; i++) events.push(...game.update(1 / 60, true));
    expect(events.some((e) => e.type === "hit")).toBe(true);
  });

  it("waits for the photo after a hit: no more shots until unlocked", () => {
    const game = new HeartHuntEngine(seeded(3));
    game.resize(360);
    shootAt(game, game.hearts[0]!.id);
    expect(game.locked).toBe(true);
    expect(game.shoot()).toBe(false);
    game.unlock();
    expect(game.shoot()).toBe(true);
  });

  it("limits how many arrows fly at once and removes arrows that leave the screen", () => {
    const game = new HeartHuntEngine(seeded(4));
    game.resize(360);
    game.hearts = [];
    game.aimBy(-10); // far left, clamped
    let fired = 0;
    for (let i = 0; i < 40; i++) {
      if (game.shoot()) fired++;
      game.update(0.3, true);
    }
    expect(fired).toBeGreaterThan(5);
    expect(game.arrows.length).toBeLessThanOrEqual(6);
    for (let i = 0; i < 120; i++) game.update(1 / 30, true);
    expect(game.arrows).toHaveLength(0);
  });

  it("holding the aim buttons turns the bow, but never past the limit", () => {
    const game = new HeartHuntEngine();
    game.resize(360);
    game.aimDir = 1;
    for (let i = 0; i < 300; i++) game.update(1 / 60, true);
    const max = game.angle;
    expect(max).toBeGreaterThan(1.2);
    game.update(1, true);
    expect(game.angle).toBe(max);
  });
});

describe("pixel heart hunt — endless mode", () => {
  it("keeps a steady number of hearts and particles over a long session", () => {
    const game = new HeartHuntEngine(seeded(9));
    const w = worldWidth(375, 620);
    game.resize(w);
    game.startEndless();
    const want = endlessHeartCount(w);
    expect(game.aliveCount()).toBe(want);
    let hits = 0;
    for (let round = 0; round < 150; round++) {
      const target = game.hearts.find((h) => h.popT === null && h.age > 0.3) ?? game.hearts[0]!;
      // Let new hearts finish appearing so they can be hit.
      for (let i = 0; i < 20; i++) game.update(1 / 60, true);
      hits += shootAt(game, target.id).filter((e) => e.type === "hit").length;
      expect(game.hearts.length).toBe(want);
      expect(game.particles.length).toBeLessThanOrEqual(90);
      expect(game.arrows.length).toBeLessThanOrEqual(6);
    }
    expect(hits).toBeGreaterThan(100);
  });

  it("uses more hearts on a wide screen", () => {
    expect(endlessHeartCount(360)).toBeLessThan(endlessHeartCount(900));
  });
});

describe("pixel heart hunt — the surprise's phases", () => {
  const run = (actions: Action[], from: GameState = initialGame()) => actions.reduce(reduce, from);
  const heart: Action[] = [{ type: "hit" }, { type: "popped" }];

  it("each heart shows the next photo, the fifth photo comes before the letter", () => {
    let st = run([{ type: "start" }]);
    for (let i = 0; i < 5; i++) {
      st = run(heart, st);
      expect(st.phase).toBe("MEMORY_REVEAL");
      expect(st.openMemory).toBe(i);
      expect(st.collected).toBe(i + 1);
      st = run([{ type: "closeMemory" }], st);
    }
    expect(st.phase).toBe("LETTER_UNLOCK");
    st = run([{ type: "openLetter" }, { type: "openLetter" }], st);
    expect(st.phase).toBe("LETTER_OPEN");
    st = run([{ type: "keepPlaying" }, { type: "hit" }, { type: "hit" }], st);
    expect(st.phase).toBe("ENDLESS");
    expect(st.score).toBe(2);
    expect(st.collected).toBe(5);
  });

  it("ignores duplicate or out-of-place events", () => {
    let st = run([{ type: "start" }, { type: "hit" }, { type: "popped" }, { type: "hit" }, { type: "popped" }]);
    // Only one photo opens; the stray events while it's open change nothing.
    expect(st.phase).toBe("MEMORY_REVEAL");
    expect(st.collected).toBe(1);
    expect(st.unlocked).toBe(1);
    st = run([{ type: "openLetter" }, { type: "keepPlaying" }], st);
    expect(st.phase).toBe("MEMORY_REVEAL");
  });

  it("the letter can't open before all five hearts", () => {
    const st = run([{ type: "start" }, ...heart, { type: "closeMemory" }, { type: "openLetter" }]);
    expect(st.phase).toBe("PLAYING");
  });

  it("memories and reset go back where they came from; reset starts over completely", () => {
    let st = run([{ type: "start" }, ...heart, { type: "closeMemory" }, { type: "openGallery" }, { type: "viewMemory", index: 3 }]);
    expect(st.openMemory).toBeNull(); // memory 4 isn't unlocked yet
    st = run([{ type: "viewMemory", index: 0 }, { type: "back" }, { type: "back" }], st);
    expect(st.phase).toBe("PLAYING");
    st = run([{ type: "askReset" }, { type: "back" }], st);
    expect(st.phase).toBe("PLAYING");
    expect(st.collected).toBe(1);
    st = run([{ type: "askReset" }, { type: "reset" }], st);
    expect(st).toEqual(initialGame(1));
  });
});
