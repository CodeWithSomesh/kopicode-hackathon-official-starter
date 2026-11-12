import { dict } from "./dict";
import type { Lang } from "./config";

export type Vars = Record<string, string | number>;

/**
 * Pure translate: the English text is the key. `en` returns the English; `mglish` returns the dictionary entry,
 * or the English when there is none (so a half-finished dictionary never shows a blank). `{name}` placeholders
 * are filled from `vars` in both languages. Use it anywhere (server, client, plain modules).
 */
export function translate(lang: Lang, en: string, vars?: Vars): string {
  const text = lang === "mglish" ? (dict[en] ?? en) : en;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

export type TFn = (en: string, vars?: Vars) => string;
