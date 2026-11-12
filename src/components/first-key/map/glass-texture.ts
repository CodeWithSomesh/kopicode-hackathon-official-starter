import type { ThemeColors } from "../use-theme-colors";

// Our own glass-tower window grid, drawn at runtime from theme tokens (no image files).
// One tile = 8 x 8 windows; MapLibre repeats it over every wall and roof.
const CELLS = 8;
const CELL = 16; // device px per window
const SIZE = CELLS * CELL;

const parse = (rgb: string) => (rgb.match(/\d+/g) ?? ["128", "128", "128"]).slice(0, 3).map(Number);
export const mix = (a: string, b: string, t: number) => {
  const [p, q] = [parse(a), parse(b)];
  return `rgb(${p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(",")})`;
};

/** A tiny deterministic noise so the tile looks the same every time, but not like a flat checkerboard. */
const noise = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

// Lit windows at night: warm yellow, on our township towers only (the real buildings are plain massing).
const LIT = { colour: "rgb(255,214,115)", share: 0.22 }; // calm: a scatter of lit windows, not a checkerboard

/**
 * `lit` (0..1) is how much of the night-time window glow is on: 0 = all dark panes, 1 = full. Light variant ignores it.
 */
export function drawGlassTexture(colors: ThemeColors, dark: boolean, lit = 1): ImageData {
  const night = LIT;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const tint = colors["chart-3"];
  // Light: pale blue-green glass. Dark: deep glass with a few warm lit windows.
  const tones = dark
    ? [0.32, 0.38, 0.44, 0.5].map((t) => mix(tint, colors.background, t))
    : [0.16, 0.22, 0.28, 0.34].map((t) => mix(tint, colors.background, t));
  const frame = dark ? mix(colors.background, colors.foreground, 0.22) : mix(colors.foreground, colors.background, 0.82);
  ctx.fillStyle = frame;
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let r = 0; r < CELLS; r++) {
    for (let c = 0; c < CELLS; c++) {
      const n = noise(c, r);
      const isLit = dark && n > 1 - night.share * lit; // windows come on in a fixed random order as `lit` rises
      ctx.fillStyle = isLit ? night.colour : tones[Math.floor(n * tones.length) % tones.length];
      // 2px mullions either side, a thicker spandrel band under every fourth floor
      const spandrel = r % 4 === 3 ? 6 : 2;
      ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 3, CELL - spandrel - 1);
      // sky glint on the top edge of each pane
      ctx.fillStyle = dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.35)";
      ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 3, 2);
    }
  }
  return ctx.getImageData(0, 0, SIZE, SIZE);
}
