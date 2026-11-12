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

// Lit windows at night: warm yellow, brighter and more of them on our township, a quieter variant on the neighbours.
const LIT_TOWNSHIP = { colour: "rgb(255,214,115)", share: 0.4 };
const LIT_QUIET = { colour: "rgb(222,176,92)", share: 0.25 };

/**
 * `lit` (0..1) is how much of the night-time window glow is on: 0 = all dark panes, 1 = full. Light variant ignores it.
 * `quiet` is the variant for the surrounding basemap buildings (fewer, dimmer lit windows, darker glass).
 */
export function drawGlassTexture(colors: ThemeColors, dark: boolean, lit = 1, quiet = false): ImageData {
  const night = quiet ? LIT_QUIET : LIT_TOWNSHIP;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const tint = colors["chart-3"];
  // Light: pale blue-green glass. Dark: deep glass with a few warm lit windows.
  const tones = dark
    ? (quiet ? [0.45, 0.55, 0.65, 0.75] : [0.25, 0.37, 0.5, 0.62]).map((t) => mix(tint, colors.background, t))
    : (quiet ? [0.3, 0.38, 0.46, 0.54] : [0.1, 0.2, 0.3, 0.42]).map((t) => mix(tint, colors.background, t)); // quiet: paler, so ours stay the hero
  const frame = dark ? mix(colors.background, colors.foreground, 0.22) : mix(colors.foreground, colors.background, 0.82);
  ctx.fillStyle = frame;
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let r = 0; r < CELLS; r++) {
    for (let c = 0; c < CELLS; c++) {
      const n = noise(c, r);
      const isLit = dark && n > 1 - night.share * lit; // windows come on in a fixed random order as `lit` rises
      ctx.fillStyle = isLit ? night.colour : tones[Math.floor(n * tones.length) % tones.length];
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

/**
 * Low buildings (houses, shophouses): a plastered wall in a warm neutral from the tokens, with small windows
 * (one window in each 16 px cell, two cells a floor). At night the plaster darkens and about a quarter of the windows are lit.
 */
export function drawWallTexture(colors: ThemeColors, dark: boolean): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const plaster = dark ? mix(colors.muted, colors.background, 0.4) : mix(colors.muted, colors.card, 0.55);
  const shade = dark ? mix(plaster, colors.background, 0.3) : mix(plaster, colors.foreground, 0.08);
  ctx.fillStyle = plaster;
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let r = 0; r < CELLS; r++) {
    for (let c = 0; c < CELLS; c++) {
      const n = noise(c + 7, r + 3);
      const lit = dark && n > 1 - LIT_QUIET.share;
      ctx.fillStyle = lit ? LIT_QUIET.colour : dark ? mix(plaster, colors.background, 0.5) : mix(plaster, colors.foreground, 0.3);
      ctx.fillRect(c * CELL + 4, r * CELL + 3, CELL - 8, CELL - 9); // a small window
      ctx.fillStyle = shade;
      ctx.fillRect(c * CELL, r * CELL + CELL - 2, CELL, 2); // a sill line under every row
    }
  }
  return ctx.getImageData(0, 0, SIZE, SIZE);
}
