/**
 * Pixel art for the page around the game (buttons, envelope, letter), drawn as crisp SVG
 * rectangles from the same kind of string bitmaps as the canvas sprites, so it all matches.
 */
type Bitmap = readonly string[];

export function PixelArt({ bitmap, colors, className }: { bitmap: Bitmap; colors: Record<string, string>; className?: string }) {
  const w = bitmap[0]?.length ?? 0;
  const h = bitmap.length;
  const rects: { x: number; y: number; len: number; c: string }[] = [];
  bitmap.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      const color = colors[ch];
      let len = 1;
      while (row[x + len] === ch) len++;
      if (color) rects.push({ x, y, len, c: color });
      x += len;
    }
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={className} shapeRendering="crispEdges" aria-hidden focusable="false">
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.len} height={1} fill={r.c} />
      ))}
    </svg>
  );
}

const INK = { x: "currentColor" };

export const ICONS = {
  left: ["...x...", "..xx...", ".xxxxxx", "xxxxxxx", ".xxxxxx", "..xx...", "...x..."],
  right: ["...x...", "...xx..", "xxxxxx.", "xxxxxxx", "xxxxxx.", "...xx..", "...x..."],
  heart: [".xx.xx.", "xxxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."],
  restart: ["..xxxx.x", ".x....xx", "x....xxx", "x.......", "x.......", "x......x", ".x....x.", "..xxxx.."],
  photo: ["xxxxxxxx", "x......x", "x.x....x", "x...x..x", "x..xxx.x", "x.xxxxxx", "xxxxxxxx"],
  soundOn: ["...x....", "..xx..x.", "xxxx...x", "xxxx.x.x", "xxxx...x", "..xx..x.", "...x...."],
  soundOff: ["...x....", "..xx....", "xxxx.x.x", "xxxx..x.", "xxxx.x.x", "..xx....", "...x...."],
  letter: ["xxxxxxxx", "xx....xx", "x.x..x.x", "x..xx..x", "x......x", "xxxxxxxx"],
  close: ["x.....x", ".x...x.", "..x.x..", "...x...", "..x.x..", ".x...x.", "x.....x"],
} as const satisfies Record<string, Bitmap>;

export function Icon({ name, className }: { name: keyof typeof ICONS; className?: string }) {
  return <PixelArt bitmap={ICONS[name]} colors={INK} className={className} />;
}

// ─── The envelope (o outline · c cream · d fold shade · b inside) ─────────────

const ENV_W = 34;
const ENV_H = 22;
const FLAP_H = 13;

function grid(w: number, h: number, at: (x: number, y: number) => string): string[] {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => at(x, y)).join(""));
}

/** The back and inside of the envelope (seen once the flap is open). */
export const ENVELOPE_BACK = grid(ENV_W, ENV_H, (x, y) => (x === 0 || y === 0 || x === ENV_W - 1 || y === ENV_H - 1 ? "o" : "b"));

/** The pocket in front of the letter: the side folds meet in a V, open at the top. */
export const ENVELOPE_FRONT = grid(ENV_W, ENV_H, (x, y) => {
  if (x === 0 || x === ENV_W - 1 || y === ENV_H - 1) return "o";
  const mid = (ENV_W - 1) / 2;
  const foldY = Math.round((mid - Math.abs(x - mid)) * 0.7);
  if (y < foldY) return ".";
  if (y === foldY) return "o";
  return y === foldY + 1 ? "d" : "c";
});

/** The flap, pointing down over the pocket when closed. */
export const ENVELOPE_FLAP = grid(ENV_W, FLAP_H, (x, y) => {
  const mid = (ENV_W - 1) / 2;
  const half = mid * (1 - y / FLAP_H);
  const d = Math.abs(x - mid);
  if (d > half + 0.5) return ".";
  if (y === 0 || d > half - 1) return "o";
  return y < 2 ? "d" : "c";
});

export const SEAL = ["..ooo.ooo..", ".ohhhohhho.", "ohwhhhhhhho", "ohhhhhhhhho", ".ohhhhhhho.", "..ohhhhho..", "...ohhho...", "....oho....", ".....o....."];

export const ENVELOPE_SIZE = { w: ENV_W, h: ENV_H, flap: FLAP_H };
