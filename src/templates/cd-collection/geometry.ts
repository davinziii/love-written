/**
 * CD Collection — pure geometry (no React, no DOM), so it can be unit-tested.
 *
 * The scene is a row of jewel cases standing on a floor, seen from above and to the side
 * with an orthographic camera (like the reference: no perspective shrink down the row).
 * Every visible face of every case is a parallelogram on screen, so each one is drawn as a
 * plain element with a 2D `matrix()` transform — far cheaper than a real 3D scene with
 * hundreds of depth-sorted planes, and identical for an orthographic view.
 *
 * World units are millimetres of a real jewel case. Axes: x = along a case's width,
 * y = down (as on screen), z = toward the front of the row.
 */

export const CASE = {
  /** A jewel case is 142 × 125 × 10 mm. */
  w: 142,
  h: 125,
  t: 10,
  /** Spacing between cases along the row (front to front). */
  gap: 44,
} as const;

/** Camera: turned 25° and looking down 28° — the row rises at ~45° and case tops tilt ~13°. */
const YAW = (-25 * Math.PI) / 180;
const PITCH = (-28 * Math.PI) / 180;

/**
 * A pulled-out case slides straight out sideways, along its own width, staying in its slot in
 * the row (the cases in front still cover it where they overlap). The distance is a share of
 * the case width — proportional, so it looks the same at every zoom level.
 */
export const EXTRACT = { side: 0.6, forward: 0 } as const;

export type Vec3 = readonly [number, number, number];
export type Vec2 = readonly [number, number];

/** Orthographic projection of a world point to screen units (before scaling). */
export function project([x, y, z]: Vec3): Vec2 {
  const cy = Math.cos(YAW);
  const sy = Math.sin(YAW);
  const cp = Math.cos(PITCH);
  const sp = Math.sin(PITCH);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  return [x1, y * cp - z1 * sp];
}

/** A CSS `matrix(a, b, c, d, e, f)` for an element sized `width × height` (world units). */
export interface FaceTransform {
  width: number;
  height: number;
  matrix: string;
}

function face(origin: Vec3, u: Vec3, v: Vec3, scale: number, offset: Vec2): FaceTransform {
  const width = Math.hypot(...u);
  const height = Math.hypot(...v);
  const [ox, oy] = project(origin);
  const [ux, uy] = project(u);
  const [vx, vy] = project(v);
  const k = (n: number) => +n.toFixed(5);
  return {
    width,
    height,
    matrix: `matrix(${k((ux / width) * scale)}, ${k((uy / width) * scale)}, ${k((vx / height) * scale)}, ${k((vy / height) * scale)}, ${k(ox * scale + offset[0])}, ${k(oy * scale + offset[1])})`,
  };
}

export interface CaseGeometry {
  front: FaceTransform;
  right: FaceTransform;
  top: FaceTransform;
  /** Soft shadow on the floor behind the case. */
  shadow: FaceTransform;
  /** Screen offset (px) when pulled out. */
  extract: Vec2;
  /** Screen centre of the case's front at rest (px), for scrolling it into view. */
  center: Vec2;
}

export interface Layout {
  /** px per world unit. */
  scale: number;
  /** Size of the drawing (px). Bigger than the viewport when panning is needed. */
  width: number;
  height: number;
  /** The collection doesn't fit legibly: the viewport scrolls instead of shrinking further. */
  pan: boolean;
  cases: CaseGeometry[];
}

export interface Viewport {
  width: number;
  height: number;
  /** Space kept clear around the collection: top, right, bottom, left (px). */
  margin: readonly [number, number, number, number];
}

const caseZ = (i: number) => -i * CASE.gap;

/** World-space displacement of a pulled-out case. */
function extractVector(): Vec3 {
  return [EXTRACT.side * CASE.w, 0, EXTRACT.forward * CASE.w];
}

/** Every corner a case can occupy, at rest and pulled out — used for the bounds. */
function corners(i: number): Vec3[] {
  const z0 = caseZ(i);
  const [ex, , ez] = extractVector();
  const out: Vec3[] = [];
  for (const [dx, dz] of [
    [0, 0],
    [ex, ez],
  ] as const) {
    for (const x of [0, CASE.w]) for (const y of [-CASE.h, 0]) for (const z of [z0 - CASE.t, z0]) out.push([x + dx, y, z + dz]);
  }
  return out;
}

/** Projected bounds of the whole collection at scale 1. */
export function bounds(count: number): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    for (const c of corners(i)) {
      const [x, y] = project(c);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

/** A case's on-screen width (px) at a given scale. */
export function caseScreenWidth(scale: number): number {
  return Math.hypot(...project([CASE.w, 0, 0])) * scale;
}

/**
 * Fit the collection to the viewport. Fewer cases → bigger cases; more → smaller, smoothly,
 * because the scale comes from the real projected size of the row. Cases never get smaller
 * than a legible minimum (the viewport pans instead) or larger than a sensible maximum.
 */
export function layoutCollection(count: number, view: Viewport): Layout {
  const [mt, mr, mb, ml] = view.margin;
  const b = bounds(count);
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  const availW = Math.max(1, view.width - ml - mr);
  const availH = Math.max(1, view.height - mt - mb);
  const fit = Math.min(availW / bw, availH / bh);

  const unitWidth = caseScreenWidth(1);
  // Smallest legible case: ~22% of a phone's width, never under 64 px or above 96 px.
  const minCase = Math.min(96, Math.max(64, view.width * 0.22));
  const maxCase = Math.max(minCase, Math.min(300, view.width * 0.34));
  const minScale = minCase / unitWidth;
  const maxScale = maxCase / unitWidth;
  const scale = Math.min(maxScale, Math.max(minScale, fit));
  const pan = fit < minScale;

  // Centre the drawing in the viewport; when panning, the drawing is simply bigger.
  const drawW = bw * scale + ml + mr;
  const drawH = bh * scale + mt + mb;
  const width = Math.max(view.width, drawW);
  const height = Math.max(view.height, drawH);
  const offset: Vec2 = [
    ml + (width - drawW) / 2 - b.minX * scale,
    mt + (height - drawH) / 2 - b.minY * scale,
  ];

  const [ex, ey] = project(extractVector());
  const cases: CaseGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const z = caseZ(i);
    const { w, h, t } = CASE;
    const [cx, cy] = project([w / 2, -h / 2, z]);
    cases.push({
      front: face([0, -h, z], [w, 0, 0], [0, h, 0], scale, offset),
      right: face([w, -h, z], [0, 0, -t], [0, h, 0], scale, offset),
      top: face([0, -h, z - t], [w, 0, 0], [0, 0, t], scale, offset),
      shadow: face([0, 0, z - t], [w, 0, 0], [0, 0, -CASE.gap * 0.9], scale, offset),
      extract: [ex * scale, ey * scale],
      center: [cx * scale + offset[0], cy * scale + offset[1]],
    });
  }
  return { scale, width, height, pan, cases };
}
