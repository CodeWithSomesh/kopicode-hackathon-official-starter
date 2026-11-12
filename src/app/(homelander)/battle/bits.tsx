"use client";

import { useEffect, useState } from "react";
import { defineSprite, Sprite } from "@/components/homelander/sprite";
import { availabilityOf, rm, rmShort, townships } from "@/lib/homelander/data";
import { realUnits } from "@/lib/homelander/recommend";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";

/* Sprites only this screen uses. Colours are currentColor, so they follow the theme. */
export const crown = defineSprite(["#..#..#", "##.#.##", "#######", "#######"]);
export const caret = defineSprite(["#######", ".#####.", "..###..", "...#..."]);
export const tick = defineSprite([
  "......#",
  ".....##",
  "#...##.",
  "##.##..",
  ".###...",
  "..#....",
]);
export const dash = defineSprite(["#####"]);
export const swords = defineSprite([
  "#.......#",
  ".#.....#.",
  "..#...#..",
  "...#.#...",
  "....#....",
  "...#.#...",
  ".##...##.",
  "##.....##",
]);
/** The speaker with a cross: fight sound muted. */
export const speakerOff = defineSprite([
  "...#....",
  "..##....",
  "####.#.#",
  "####..#.",
  "####.#.#",
  "..##....",
  "...#....",
]);
export const wallet = defineSprite([
  "########",
  "#......#",
  "#....###",
  "#....#.#",
  "#....###",
  "########",
]);
export const car = defineSprite([
  "..####..",
  ".#....#.",
  "########",
  "#.####.#",
  "########",
  ".##..##.",
]);
export const family = defineSprite([
  ".#...#..",
  "###.###.",
  ".#...#.#",
  "###.####",
  "#.#.#.#.",
  "#.#.#.#.",
]);
export const home = defineSprite([
  "...##...",
  "..####..",
  ".######.",
  "########",
  ".##..##.",
  ".##..##.",
]);
export const chart = defineSprite([
  "......#",
  ".....##",
  "..#.###",
  ".######",
  "#######",
]);
export const gauge = defineSprite([
  "..###..",
  ".#...#.",
  "#..#..#",
  "#...#.#",
  "#######",
]);

/* ---------------------------------------------------------------- formatting */

export const money = (n: number) => rm(Math.round(n));
export const kRM = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `RM${(n / 1_000_000).toFixed(2)}M`
    : `RM${Math.round(n / 1000)}k`;
export const pct = (f: number) => `${Math.round(f * 100)}%`;
export const signedPct = (f: number) =>
  `${f > 0 ? "+" : f < 0 ? "−" : ""}${Math.round(Math.abs(f) * 100)}%`;
export const sqft = (n: number) => `${n.toLocaleString("en-MY")} sq ft`;

/**
 * Steps 0 -> 1 in `steps` hard frames after mount, like an HP bar filling block by block.
 * Reduced motion: jumps straight to 1. Remount (change the key) to replay.
 */
export function useStepIn(steps = 10, frameMs = 60) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = window.setTimeout(() => setN(steps), 0);
      return () => window.clearTimeout(t);
    }
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= steps) window.clearInterval(id);
    }, frameMs);
    return () => window.clearInterval(id);
  }, [steps, frameMs]);
  return n / steps;
}

/**
 * Native select listing every real home (Gamuda Land's own figures, never estimated samples),
 * grouped by project. With `placeholder`, it is an "add"
 * picker: it resets after each pick.
 */
export function UnitSelect({
  value,
  taken,
  onChange,
  label,
  placeholder,
  compact,
  className,
}: {
  value?: string;
  taken: string[];
  onChange: (id: string) => void;
  label: string;
  placeholder?: string;
  compact?: boolean;
  className?: string;
}) {
  const tr = useT();
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className={cn(
          "pix-frame pix-flat block w-full cursor-pointer appearance-none text-ink",
          compact
            ? "min-h-9 py-1.5 pr-7 pl-2.5 text-xs font-semibold"
            : "min-h-11 py-2 pr-9 pl-3 text-sm font-semibold",
        )}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {townships.map((t) => {
          const list = realUnits.filter((u) => u.townshipId === t.id);
          if (!list.length) return null;
          return (
            <optgroup
              key={t.id}
              label={
                t.status === "completed" ? `${t.name} (${tr("completed")})` : t.name
              }
            >
              {list.map((u) => {
                const soldOut = availabilityOf(u.id).left === 0;
                const inRing = u.id !== value && taken.includes(u.id);
                return (
                  <option key={u.id} value={u.id} disabled={inRing}>
                    {u.product ? `${u.product}: ` : ""}
                    {u.name}, {rmShort(u.priceRM)}
                    {soldOut ? ` (${tr("sold out")})` : ""}
                    {inRing ? ` (${tr("in the ring")})` : ""}
                  </option>
                );
              })}
            </optgroup>
          );
        })}
      </select>
      <Sprite
        art={caret}
        scale={compact ? 1.5 : 2}
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink",
          compact ? "right-2.5" : "right-3",
        )}
      />
    </label>
  );
}

/** Horizontal DSR bar with the 60% and 70% lines drawn in. */
export function DsrBar({ value }: { value: number }) {
  const max = 1;
  const w = Math.min(value, max) * 100;
  const tone = value > 0.7 ? "bg-raya" : value > 0.6 ? "bg-kaya" : "bg-pandan";
  return (
    <span
      className="relative mt-1 block h-2.5 w-full max-w-[9rem] rounded-full bg-cloud ring-1 ring-ink/40"
      aria-hidden
    >
      <span
        className={cn("absolute inset-y-0 left-0 rounded-full", tone)}
        style={{ width: `${w}%` }}
      />
      <span className="absolute -inset-y-0.5 left-[60%] w-0.5 bg-ink" />
      <span className="absolute -inset-y-0.5 left-[70%] w-0.5 bg-ink/50" />
    </span>
  );
}
