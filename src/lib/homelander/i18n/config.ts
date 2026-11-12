/** Language list and cookie name, importable from server and client code. */

export const LANGS = ["en", "mglish"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";
export const LANG_COOKIE = "homelander-lang";

export function parseLang(v: string | undefined | null): Lang {
  return v === "mglish" ? "mglish" : DEFAULT_LANG;
}
