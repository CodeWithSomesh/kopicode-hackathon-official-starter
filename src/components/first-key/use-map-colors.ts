"use client";

import { useMemo, useSyncExternalStore } from "react";
import { DARK_THEMES, THEME_COOKIE } from "@/lib/homelander/theme-config";
import { cssColor, useThemeColors, type ThemeColors } from "./use-theme-colors";

// One source of truth for the map and the 3D burst: are we at night, and in which colours?
// 5pm challenge: the app theme sets the DEFAULT (Kopi O and Night Market are dark, the rest light): the theme switcher calls
// setMapNight() with the theme's darkness, and a fresh session starts from the theme cookie. The map's own Day / Dusk / Night
// button then works on top of that, in either direction. Pages with no HomeLander theme fall back to the <html> tokens' brightness.

const appTheme = () => document.querySelector("[data-jtheme]");
const themeCookieIsDark = () => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  return !!m?.[1] && DARK_THEMES.includes(m[1]);
};

// The map's Night toggle. Starts from the session's last choice, else from the theme cookie (Kopi O / Night Market = night).
const KEY = "homelander-map-night";
let mapNight = false;
try {
  const saved = sessionStorage.getItem(KEY);
  mapNight = saved === null ? themeCookieIsDark() : saved === "1";
} catch {}
const listeners = new Set<() => void>();
// The toggle is applied as inline custom properties on <html>: every token reader (the map, the 3D burst, its bars and its
// background fade) then sees the night colours without any change inside the burst. Cleared again when the toggle goes off.
const NIGHT_VARS: Record<string, string> = {
  "--background": "rgb(23,16,12)",
  "--card": "rgb(38,27,21)",
  "--muted": "rgb(51,37,28)",
  "--foreground": "rgb(246,237,225)",
  "--card-foreground": "rgb(246,237,225)",
  "--primary": "rgb(242,182,50)",
  "--chart-3": "rgb(63,191,138)",
  "--muted-foreground": "rgb(201,184,165)",
  "--border": "rgb(82,62,48)",
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
// Dusk (Mapbox's Standard only): a light preset, not a palette, so the UI and the 3D shot keep their day colours.
let mapDusk = false;
export function setMapDusk(on: boolean) {
  mapDusk = on;
  listeners.forEach((l) => l());
}
export function useMapDusk(): boolean {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => void listeners.delete(cb)),
    () => mapDusk,
    () => false,
  );
}
export function useMapNight(): boolean {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => void listeners.delete(cb)),
    () => mapNight,
    () => false,
  );
}

// The app theme's own colours, for when the <html> tokens disagree with it (OS dark under a light theme, or the reverse).
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
  const toggle = useMapNight();
  // Inside HomeLander the toggle alone decides (the theme switch set it); elsewhere the OS-driven tokens do.
  const hasApp = typeof document !== "undefined" && !!appTheme();
  const dark = toggle || (hasApp ? false : tokenDark);
  const colors = useMemo(() => {
    if (toggle) return tokens; // the toggle has already put the night colours on <html>
    return dark !== tokenDark ? appColors(tokens) : tokens;
  }, [tokens, dark, tokenDark, toggle]);
  return { colors, dark };
}
