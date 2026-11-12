"use client";

import { useEffect, useState } from "react";
import { defineSprite, Sprite } from "@/components/homelander/sprite";
import { townships, units, rmShort, availabilityOf } from "@/lib/homelander/data";
import { cn } from "@/lib/utils";

/* Sprites only this screen uses. */
export const crown = defineSprite(
  ["#..#..#", "##.#.##", "#######", "#k#k#k#", "#######"],
  { k: "#ef4560" },
);
export const caret = defineSprite(["#######", ".#####.", "..###..", "...#..."]);
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

/**
 * Steps 0 -> 1 in `steps` hard frames after mount, like an HP bar filling block by block.
 * Reduced motion: jumps straight to 1. Remount (change the key) to replay.
 */
export function useStepIn(steps = 10, frameMs = 70) {
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

/** Pixel-framed native select listing every unit, grouped by township. */
export function UnitSelect({
  value,
  taken,
  onChange,
  label,
  className,
}: {
  value: string;
  taken: string[];
  onChange: (id: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pix-frame pix-flat block w-full cursor-pointer appearance-none py-2 pr-9 pl-3 font-pixel text-base leading-tight text-ink"
      >
        {townships.map((t) => (
          <optgroup key={t.id} label={t.name}>
            {units
              .filter((u) => u.townshipId === t.id)
              .map((u) => {
                const soldOut = availabilityOf(u.id).left === 0;
                return (
                  <option key={u.id} value={u.id} disabled={u.id !== value && taken.includes(u.id)}>
                    {u.name}, {rmShort(u.priceRM)}
                    {soldOut ? " (sold out)" : ""}
                  </option>
                );
              })}
          </optgroup>
        ))}
      </select>
      <Sprite art={caret} scale={2} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink" />
    </label>
  );
}
