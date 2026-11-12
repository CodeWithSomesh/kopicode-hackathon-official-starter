"use client";

import { useMemo, useState, useSyncExternalStore, useEffect } from "react";
import { cssColor, useThemeColors, type ThemeColors } from "./use-theme-colors";

// One source of truth for the map and the 3D burst: are we at night, and in which colours?
// Night is on when the Night toggle (below) is on, or when the app theme is "night" (`data-jtheme` on `.homelander-world`, the
// same signal the header and panels follow, not the OS setting that flips the <html> tokens). Pages with no HomeLander theme
// fall back to the <html> tokens' brightness.

const appTheme = () => document.querySelector("[data-jtheme]");
const readAppNight = () => {
  const el = appTheme();
  return el ? el.getAttribute("data-jtheme") === "night" : null;
};
function useAppNight(): boolean | null {
  const [night, setNight] = useState(readAppNight);
  useEffect(() => {
    const el = appTheme();
    if (!el) return;
    const mo = new MutationObserver(() => setNight(readAppNight()));
    mo.observe(el, { attributes: true, attributeFilter: ["data-jtheme"] });
    return () => mo.disconnect();
  }, []);
  return night;
}

// The map's Night toggle: independent of the app theme (Kopitiam is locked to light). Default off, kept for the session only.
const KEY = "homelander-map-night";
let mapNight = false;
try {
  mapNight = sessionStorage.getItem(KEY) === "1";
} catch {}
const listeners = new Set<() => void>();
// The toggle is applied as inline custom properties on <html>: every token reader (the map, the 3D burst, its bars and its
// background fade) then sees the night colours without any change inside the burst. Cleared again when the toggle goes off.
const NIGHT_VARS: Record<string, string> = {
  "--background": "rgb(18,16,28)",
  "--card": "rgb(29,26,43)",
  "--muted": "rgb(38,34,58)",
  "--foreground": "rgb(243,239,255)",
  "--card-foreground": "rgb(243,239,255)",
  "--primary": "rgb(255,181,71)",
  "--chart-3": "rgb(45,212,167)",
  "--muted-foreground": "rgb(173,166,202)",
  "--border": "rgb(58,53,83)",
};
const applyNight = (on: boolean) => {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  for (const [k, v] of Object.entries(NIGHT_VARS)) {
    if (on) style.setProperty(k, v);
    else style.removeProperty(k);
  }
};
applyNight(mapNight);
export function setMapNight(on: boolean) {
  mapNight = on;
  applyNight(on);
  try {
    sessionStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
}
export function useMapNight(): boolean {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => void listeners.delete(cb)),
    () => mapNight,
    () => false,
  );
}

// The app theme's own colours, for when the <html> tokens disagree with it (OS dark under the light Kopitiam theme, or the reverse).
function appColors(base: ThemeColors): ThemeColors {
  const el = appTheme();
  if (!el) return base;
  const cs = getComputedStyle(el);
  const v = (n: string) => cssColor(cs.getPropertyValue(n).trim() || "#888");
  return { ...base, background: v("--color-sky"), card: v("--j-surface"), muted: v("--color-cloud"), foreground: v("--color-ink"), primary: v("--color-kaya"), "chart-3": v("--color-pandan") };
}

export function useMapColors(): { colors: ThemeColors; dark: boolean } {
  const tokens = useThemeColors();
  const tokenDark = (tokens.background.match(/\d+/g) ?? ["255"]).slice(0, 3).reduce((t, v) => t + Number(v), 0) / 3 < 128;
  const appNight = useAppNight();
  const toggle = useMapNight();
  const dark = toggle || (appNight ?? tokenDark);
  const colors = useMemo(() => {
    if (toggle) return tokens; // the toggle has already put the night colours on <html>
    return dark !== tokenDark ? appColors(tokens) : tokens;
  }, [tokens, dark, tokenDark, toggle]);
  return { colors, dark };
}
