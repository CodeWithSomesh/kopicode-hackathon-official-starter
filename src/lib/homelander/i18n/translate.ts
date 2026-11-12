import { dict } from "./dict";
import type { Lang } from "./config";

export type Vars = Record<string, string | number>;

/**
 * Pure translate: the English text is the key. `en` returns the English; `mglish` returns the dictionary entry,
 * or the English when there is none (so a half-finished dictionary never shows a blank). `{name}` placeholders
 * are filled from `vars` in both languages. Use it anywhere (server, client, plain modules).
 */
export function translate(lang: Lang, en: string, vars?: Vars): string {
  if (lang === "mglish" && !vars && !(en in dict)) {
    // Engine prose arrives with its numbers already filled in ("RM2,574 a month takes your loans to 49% of ..."):
    // match it against the dictionary's `{x}` templates and fill the Manglish template with what was captured.
    for (const [re, names, tpl] of patterns()) {
      const m = re.exec(en);
      if (m) return tpl.replace(/\{(\w+)\}/g, (all, k: string) => translate(lang, m[names.indexOf(k) + 1] ?? all));
    }
  }
  const text = lang === "mglish" ? (dict[en] ?? en) : en;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
}

export type TFn = (en: string, vars?: Vars) => string;

let compiled: [RegExp, string[], string][] | undefined;
function patterns() {
  return (compiled ??= Object.entries(dict)
    // Only templates with real wording around the placeholders (a bare "{a} to {b}" would swallow everything); the most specific first.
    .filter(([k]) => /\{\w+\}/.test(k) && k.replace(/\{\w+\}/g, "").length >= 12)
    .sort(([a], [b]) => b.replace(/\{\w+\}/g, "").length - a.replace(/\{\w+\}/g, "").length)
    .map(([k, v]): [RegExp, string[], string] => {
      const names: string[] = [];
      const src = k
        .split(/\{(\w+)\}/)
        .map((part, i) => (i % 2 ? (names.push(part), "(.*?)") : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
        .join("");
      return [new RegExp(`^${src}$`), names, v];
    }));
}
