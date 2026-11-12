"use client";

import { createContext, createElement, useContext, useSyncExternalStore } from "react";

/**
 * Design themes for the HomeLander prototype, so the team can compare looks on the real screens.
 * The choice lives in a cookie so the server renders the right theme first; the CSS is in src/app/homelander/themes.css.
 */

import { DEFAULT_THEME, LOCKED_THEME, THEME_COOKIE, parseTheme, themes, type ThemeId } from "./theme-config";

export { themes, type ThemeId };

const listeners = new Set<() => void>();

function read(): ThemeId {
  if (LOCKED_THEME) return LOCKED_THEME;
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  return parseTheme(m?.[1]);
}

export function setTheme(id: ThemeId) {
  document.cookie = `${THEME_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  document
    .querySelectorAll<HTMLElement>(".homelander-world")
    .forEach((el) => (el.dataset.jtheme = id));
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The theme the server rendered (from the cookie), so client components start in agreement with it. */
const InitialTheme = createContext<ThemeId>(DEFAULT_THEME);

export function HomeLanderThemeProvider({ initial, children }: { initial: ThemeId; children: React.ReactNode }) {
  return createElement(InitialTheme.Provider, { value: initial }, children);
}

export function useHomeLanderTheme() {
  const initial = useContext(InitialTheme);
  return useSyncExternalStore(subscribe, read, () => initial);
}

