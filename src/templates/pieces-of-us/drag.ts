/**
 * Pieces of Us — drag maths and the drag gesture, with no React or DOM so they can be tested.
 *
 * Three coordinate spaces are in play, and every conversion goes through one function here:
 *   client  — CSS pixels of the viewport, as in PointerEvent.clientX/Y and getBoundingClientRect()
 *   local   — the play area's own CSS pixels (the editor preview shrinks it with a CSS transform,
 *             so a local pixel can be smaller than a client pixel)
 *   board   — the puzzle's units (1000 wide), before the board's zoom and pan
 * Scrolling needs no special case: client coordinates and bounding rects move together.
 */

export type Pt = { x: number; y: number };
export type Rect = { left: number; top: number; width: number; height: number };
export type View = { zoom: number; x: number; y: number };

/** Client → local, for an element shown at `rect` whose own (untransformed) width is `cssWidth`. */
export function clientToLocal(p: Pt, rect: Rect, cssWidth: number): Pt {
  const k = rect.width / cssWidth || 1;
  return { x: (p.x - rect.left) / k, y: (p.y - rect.top) / k };
}

/** Client px per board unit, for the board SVG at `svgRect` with `boardW` units across and the current zoom. */
export function boardScale(svgRect: Rect, boardW: number, view: View): number {
  return (svgRect.width / boardW) * view.zoom;
}

/** Client → board (undoing the SVG's scale, then the zoom/pan transform on its content). */
export function clientToBoard(p: Pt, svgRect: Rect, boardW: number, view: View): Pt {
  const k = svgRect.width / boardW;
  return { x: ((p.x - svgRect.left) / k - view.x) / view.zoom, y: ((p.y - svgRect.top) / k - view.y) / view.zoom };
}

/** Board → client (the exact inverse of clientToBoard). */
export function boardToClient(p: Pt, svgRect: Rect, boardW: number, view: View): Pt {
  const k = svgRect.width / boardW;
  return { x: svgRect.left + (p.x * view.zoom + view.x) * k, y: svgRect.top + (p.y * view.zoom + view.y) * k };
}

/**
 * Where the pointer holds a piece, as an offset inside the floating piece's box at full size.
 * The tray shows the same box smaller, so the offset is scaled up from the tray button —
 * that way the floating piece appears exactly over the tray piece, held at the same spot.
 */
export function grabOffset(pointer: Pt, trayRect: Rect, fullWidth: number): Pt {
  const ratio = trayRect.width / fullWidth || 1;
  return { x: (pointer.x - trayRect.left) / ratio, y: (pointer.y - trayRect.top) / ratio };
}

/**
 * The floating piece's box is positioned by its top-left corner and scaled around the grab point
 * (`transform-origin`), so whatever its scale, the grab point stays under the pointer:
 * top-left = pointer − grab offset.
 */
export function ghostTopLeft(pointer: Pt, grab: Pt): Pt {
  return { x: pointer.x - grab.x, y: pointer.y - grab.y };
}

/**
 * The piece's cell corner (where it snaps from) while held: the box's top-left plus the knob
 * room `pad`, both scaled around the grab point by the current lift `scale`.
 */
export function heldCorner(pointer: Pt, grab: Pt, pad: number, scale: number): Pt {
  return { x: pointer.x - (grab.x - pad) * scale, y: pointer.y - (grab.y - pad) * scale };
}

/**
 * Top-left for a box scaled by `scale` around `origin` so that its visible corner lands on
 * `visibleTopLeft` (used to fly a piece back into its smaller tray button).
 */
export function topLeftForScaled(visibleTopLeft: Pt, origin: Pt, scale: number): Pt {
  return { x: visibleTopLeft.x - origin.x * (1 - scale), y: visibleTopLeft.y - origin.y * (1 - scale) };
}

/** How far a pointer must move before a press becomes a drag (taps stay taps). */
export const DRAG_SLOP = { mouse: 4, touch: 6, pen: 5 } as const;

export type GestureResult = "ignore" | "pending" | "start" | "move" | "tap" | "drop" | "cancel-tap" | "cancel-drag";

/**
 * One press on a tray piece: pending → (moved past the slop) dragging → dropped, or a tap.
 * Only the pointer that started it counts; a new press while an old one is somehow still
 * "down" (its release was lost) replaces it, so a piece can never stay stuck.
 */
export class DragGesture {
  pointerId: number | null = null;
  pieceId: number | null = null;
  pointerType: string = "mouse";
  start: Pt = { x: 0, y: 0 };
  last: Pt = { x: 0, y: 0 };
  dragging = false;

  get active() {
    return this.pointerId !== null;
  }

  /** Begin a press. Returns what happened to an older, stale press (if any). */
  down(pointerId: number, pieceId: number, pointerType: string, at: Pt): "fresh" | "replaced-tap" | "replaced-drag" {
    const previous = !this.active ? "fresh" : this.dragging ? "replaced-drag" : "replaced-tap";
    this.pointerId = pointerId;
    this.pieceId = pieceId;
    this.pointerType = pointerType;
    this.start = at;
    this.last = at;
    this.dragging = false;
    return previous;
  }

  move(pointerId: number, at: Pt): GestureResult {
    if (pointerId !== this.pointerId) return "ignore";
    this.last = at;
    if (this.dragging) return "move";
    const slop = DRAG_SLOP[this.pointerType as keyof typeof DRAG_SLOP] ?? DRAG_SLOP.mouse;
    if (Math.hypot(at.x - this.start.x, at.y - this.start.y) <= slop) return "pending";
    this.dragging = true;
    return "start";
  }

  up(pointerId: number, at: Pt): GestureResult {
    if (pointerId !== this.pointerId) return "ignore";
    this.last = at;
    const result = this.dragging ? "drop" : "tap";
    this.reset();
    return result;
  }

  cancel(pointerId?: number): GestureResult {
    if (!this.active || (pointerId !== undefined && pointerId !== this.pointerId)) return "ignore";
    const result = this.dragging ? "cancel-drag" : "cancel-tap";
    this.reset();
    return result;
  }

  private reset() {
    this.pointerId = null;
    this.dragging = false;
  }
}
