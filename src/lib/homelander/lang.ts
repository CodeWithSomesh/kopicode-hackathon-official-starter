/** Mochi's four languages and a quick guess at which one a line is in. Safe on client and server. */

export const mochiLangs = ["en", "ms", "zh", "ta"] as const;
export type MochiLang = (typeof mochiLangs)[number];

/** Rough language of a message: script first (Tamil, Chinese), then common Malay words. */
export function detectLang(text: string): MochiLang {
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
  // Tamil the recogniser wrote in Latin letters ("naan en manaivi kooda irukken").
  const tamil = text
    .toLowerCase()
    .match(/\b(naan|naanga|enakku|ennoda|en|unga|ungal|veedu|veetla|vela|velai|irukken|irukku|illa|illai|romba|enna|epdi|eppadi|sambalam|manaivi|kooda|amma|appa|kudumbam|panam|vaanga|vaangu|varushum|vayasu)\b/g);
  if ((tamil?.length ?? 0) >= 3) return "ta";
  const malay = text
    .toLowerCase()
    .match(/\b(saya|kami|kerja|rumah|tiada|takde|tak|dengan|dan|ada|nak|boleh|sebulan|gaji|hari|naik|simpanan|hutang|anak|isteri|suami|dekat|mahu|untuk|bilik|tahun|umur|ribu|seminggu|tinggal|bersama|pinjaman|kereta|takut|duit|tunggu|teruk|banjir|lama)\b/g);
  return (malay?.length ?? 0) >= 2 ? "ms" : "en";
}

/**
 * detectLang, but only when the line clearly says so: Tamil or Chinese script, Malay with at least
 * two Malay words, English with at least four words. null while it's too early to tell.
 */
export function clearLang(text: string): MochiLang | null {
  const lang = detectLang(text);
  if (lang !== "en") return lang;
  return (text.match(/[a-z]+/gi)?.length ?? 0) >= 4 ? "en" : null;
}
