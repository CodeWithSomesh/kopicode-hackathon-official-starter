import { Sprite, defineSprite } from "@/components/homelander/sprite";
import { cn } from "@/lib/utils";

/**
 * Uncle, 16x16: balding with grey sides, square glasses, grey moustache, white singlet,
 * and a kopi in his right hand (this screen's one hidden kopi).
 * "#" is ink (currentColor). The talking frame only swaps the chin row for an open mouth.
 */
const colors = {
  s: "#e0a77a", // skin
  d: "#b97c55", // skin shadow
  h: "#c9c4d6", // grey hair
  g: "#2b1d3f", // glasses frame
  l: "#d6efff", // lens
  m: "#8a8496", // moustache
  w: "#ffffff", // singlet
  k: "#2b1d3f", // cup outline
  t: "#a0612f", // kopi
  v: "#ffffff", // steam
  o: "#5b1e2a", // open mouth
};

const rows = [
  ".....#####......",
  "....#sssss#.....",
  "...#sssssss#....",
  "..#hsssssssh#...",
  "..#hgggsgggh#...",
  "..#sglgsglgs#...",
  "..#sssssssss#...",
  "..#ssssdssss#...",
  "...#smmmmms#....",
  "....#sssss#.....",
  "...##wsssw##...v",
  "..#wwwwwwwww#.v.",
  ".#swwwwwwwwws#v.",
  ".#swwwwwwwwwskkk",
  ".#swwwwwwwwwsktk",
  ".##wwwwwwwwwwkkk",
];

const uncleArt = defineSprite(rows, colors);
const mouthArt = defineSprite(
  rows.map((r, y) => (y === 9 ? "....#sooos#....." : ".".repeat(16))),
  colors,
);

export function UnclePortrait({ speaking, scale = 10, className }: { speaking: boolean; scale?: number; className?: string }) {
  return (
    <div
      className={cn("relative animate-[pix-bob_1.4s_steps(2)_infinite]", className)}
      style={{ width: 16 * scale, height: 16 * scale }}
    >
      <Sprite art={uncleArt} scale={scale} label="Uncle, a pixel kopitiam uncle in a singlet holding a kopi" className="text-ink" />
      {speaking ? (
        <Sprite
          art={mouthArt}
          scale={scale}
          className="absolute inset-0 animate-[pix-blink_0.32s_steps(1)_infinite] text-ink"
        />
      ) : null}
    </div>
  );
}
