import type { ThemeColors } from "../use-theme-colors";

// Our own glass-tower window grid, drawn at runtime from theme tokens (no image files).
// One tile = 8 x 8 windows; MapLibre repeats it over every wall and roof.
const CELLS = 8;
const CELL = 16; // device px per window
const SIZE = CELLS * CELL;

const parse = (rgb: string) => (rgb.match(/\d+/g) ?? ["128", "128", "128"]).slice(0, 3).map(Number);
const mix = (a: string, b: string, t: number) => {
  const [p, q] = [parse(a), parse(b)];
  return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(",")})`;
};

/** A tiny deterministic noise so the tile looks the same every time, but not like a flat checkerboard. */
const noise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** `lit` (0..1) is how much of the night-time window glow is on: 0 = all dark panes, 1 = full. Light variant ignores it. */
export function drawGlassTexture(colors: ThemeColors, dark: boolean, lit = 1): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const tint = colors["chart-3"];
  // Light: pale blue-green glass. Dark: deep glass with a few warm lit windows.
  const tones = dark
    ? [0.25, 0.37, 0.5, 0.62].map((t) => mix(tint, colors.background, t))
    : [0.1, 0.2, 0.3, 0.42].map((t) => mix(tint, colors.background, t));
  const frame = dark ? mix(colors.background, colors.foreground, 0.22) : mix(colors.foreground, colors.background, 0.82);
  ctx.fillStyle = frame;
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let r = 0; r < CELLS; r++) {
    for (let c = 0; c < CELLS; c++) {
      const n = noise(c, r);
      const isLit = dark && n > 1 - 0.22 * lit; // windows come on in a fixed random order as `lit` rises
      ctx.fillStyle = isLit ? mix(colors.primary, colors.foreground, 0.25) : tones[Math.floor(n * tones.length) % tones.length];
      // 2px mullions either side, a thicker spandrel band under every fourth floor
      const spandrel = r % 4 === 3 ? 4 : 2;
      ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 3, CELL - spandrel - 1);
      // sky glint on the top edge of each pane
      ctx.fillStyle = dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.35)";
      ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 3, 2);
    }
  }
  return ctx.getImageData(0, 0, SIZE, SIZE);
}
