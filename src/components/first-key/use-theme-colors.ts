"use client";

import { useEffect, useState } from "react";

// WebGL and the map style need real colour values, not CSS variables. Tokens are oklch(),
// which MapLibre and three.js can't parse, so a 1px canvas converts any CSS colour to rgb().
const TOKENS = [
  "background",
  "card",
  "muted",
  "foreground",
  "primary",
  "muted-foreground",
  "border",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
] as const;

export type ThemeColors = Record<(typeof TOKENS)[number], string>;

function toRgb(ctx: CanvasRenderingContext2D, css: string): string {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000";
  ctx.fillStyle = css; // an unparseable value leaves black
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${g},${b})`;
}

/** Any CSS colour (hex, oklch, ...) as rgb(): MapLibre and three.js can't parse the rest. */
export function cssColor(css: string): string {
  return toRgb(document.createElement("canvas").getContext("2d", { willReadFrequently: true })!, css);
}

export function readThemeColors(): ThemeColors {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    TOKENS.map((t) => [t, toRgb(ctx, style.getPropertyValue(`--${t}`).trim() || "#888")]),
  ) as ThemeColors;
}

/** Current token colours as rgb(); re-read whenever <html> class, data-theme or style changes (any theme). */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState(readThemeColors);
  useEffect(() => {
    const update = () => setColors((prev) => {
      const next = readThemeColors();
      return TOKENS.every((t) => prev[t] === next[t]) ? prev : next;
    });
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    return () => mo.disconnect();
  }, []);
  return colors;
}
