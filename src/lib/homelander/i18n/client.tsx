"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { DEFAULT_LANG, LANG_COOKIE, parseLang, type Lang } from "./config";
import { translate, type TFn } from "./translate";

/**
 * Language for client components. The server reads the cookie and hands the value to <LangProvider> (src/app/layout.tsx),
 * so the first paint is already right. setLang() writes the cookie and re-renders every mounted component that calls
 * useT()/useLang() at once; the language toggle also calls router.refresh() so server components re-render too.
 * Same pattern as src/lib/homelander/theme.ts.
 */

const listeners = new Set<() => void>();

function read(): Lang {
  const m = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]*)`));
  return parseLang(m?.[1]);
}

export function setLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The language the server rendered, so client components start in agreement with it. */
const InitialLang = createContext<Lang>(DEFAULT_LANG);

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  return <InitialLang.Provider value={initial}>{children}</InitialLang.Provider>;
}

export function useLang(): Lang {
  const initial = useContext(InitialLang);
  return useSyncExternalStore(subscribe, read, () => initial);
}

/** `const t = useT(); t("Start with Uncle")`, `t("{n} units left", { n })`. Call it at render time, never at module scope. */
export function useT(): TFn {
  const lang = useLang();
  return useCallback<TFn>((en, vars) => translate(lang, en, vars), [lang]);
}
