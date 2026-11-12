import type { SVGProps } from "react";

/**
 * Pixel sprites drawn from text grids. Each character is one pixel:
 * "." is transparent, "#" is currentColor, any other character maps through `colors`.
 * Feature code can define its own sprites with `defineSprite` and render them with <Sprite>.
 */

export type SpriteArt = { rows: string[]; colors?: Record<string, string> };

export const defineSprite = (
  rows: string[],
  colors?: Record<string, string>,
): SpriteArt => ({ rows, colors });

const INK = "#2b1d3f";
const WHITE = "#ffffff";

export const sprites = {
  heart: defineSprite(
    [".##.##.", "#w#####", "#######", ".#####.", "..###..", "...#..."],
    { w: WHITE },
  ),
  cross: defineSprite([
    "##...##",
    "###.###",
    ".#####.",
    "..###..",
    ".#####.",
    "###.###",
    "##...##",
  ]),
  house: defineSprite(
    [
      "....#....",
      "...###...",
      "..#####..",
      ".#######.",
      "#########",
      ".#w###w#.",
      ".#######.",
      ".###w###.",
      ".###w###.",
    ],
    { w: WHITE },
  ),
  pin: defineSprite(
    [
      "..###..",
      ".#####.",
      "##www##",
      "##www##",
      ".#####.",
      ".#####.",
      "..###..",
      "..###..",
      "...#...",
    ],
    {
      w: WHITE,
    },
  ),
  bank: defineSprite([
    "....#....",
    "...###...",
    ".#######.",
    "#########",
    ".#.#.#.#.",
    ".#.#.#.#.",
    ".#.#.#.#.",
    "#########",
  ]),
  bars: defineSprite([
    "#........",
    "#.....#..",
    "#.#...#..",
    "#.#.#.#.#",
    "#.#.#.#.#",
    "#.#.#.#.#",
    "#########",
  ]),
  /** Mochi, the rice-cake helper: leaf sprout, round white body, two eyes, rosy cheeks. */
  mochi: defineSprite(
    [
      "....gg...",
      "....k....",
      "..kkkkk..",
      ".kwwwwwk.",
      "kwwkwkwwk",
      "kpwwwwwpk",
      "kwwwkwwwk",
      "kwwwwwwwk",
      ".kkkkkkk.",
    ],
    { k: INK, g: "#1f9d6b", w: WHITE, p: "#f2a7a0" },
  ),
  kopi: defineSprite(
    [
      "..s..s...",
      "...s..s..",
      "kkkkkkk..",
      "ktttttkkk",
      "kwwwwwk.k",
      "kwwwwwkkk",
      ".kwwwk...",
      "kkkkkkkk.",
    ],
    { s: WHITE, k: INK, t: "#a0612f", w: WHITE },
  ),
  star: defineSprite([
    "...#...",
    "...#...",
    "#######",
    ".#####.",
    "..###..",
    ".##.##.",
    "#.....#",
  ]),
  back: defineSprite([
    "...#...",
    "..##...",
    ".######",
    "#######",
    ".######",
    "..##...",
    "...#...",
  ]),
  undo: defineSprite([
    "..#.....",
    ".##.....",
    "#######.",
    ".##....#",
    "..#....#",
    ".......#",
    "..######",
  ]),
  mic: defineSprite([
    "..###..",
    ".#####.",
    ".#####.",
    ".#####.",
    "#.###.#",
    "#.....#",
    ".#####.",
    "...#...",
    ".#####.",
  ]),
  speaker: defineSprite([
    "...#....",
    "..##.#..",
    "####..#.",
    "####..#.",
    "####..#.",
    "..##.#..",
    "...#....",
  ]),
  sparkle: defineSprite(["..#..", "..#..", "##.##", "..#..", "..#.."]),
  cloud: defineSprite(
    [
      "....wwww........",
      "..wwwwwwww.www..",
      ".wwwwwwwwwwwwww.",
      "wwwwwwwwwwwwwwww",
      "wwwwwwwwwwwwwwww",
      ".bbbbbbbbbbbbbb.",
    ],
    { w: "#f4fbff", b: "#d6efff" },
  ),
} satisfies Record<string, SpriteArt>;

export type SpriteName = keyof typeof sprites;

type Props = Omit<SVGProps<SVGSVGElement>, "children"> & {
  art: SpriteName | SpriteArt;
  /** Size of one pixel in CSS px. */
  scale?: number;
  label?: string;
};

export function Sprite({ art, scale = 3, label, ...rest }: Props) {
  const a = typeof art === "string" ? sprites[art] : art;
  const h = a.rows.length;
  const w = Math.max(...a.rows.map((r) => r.length));
  const rects: React.ReactElement[] = [];

  a.rows.forEach((row, y) => {
    // Merge horizontal runs of one colour into one rect.
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      if (ch === ".") {
        x++;
        continue;
      }
      let run = 1;
      while (row[x + run] === ch) run++;
      const fill =
        ch === "#" ? "currentColor" : (a.colors?.[ch] ?? "currentColor");
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={run}
          height={1}
          fill={fill}
        />,
      );
      x += run;
    }
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {rects}
    </svg>
  );
}
