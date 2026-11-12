import type { Dict } from "./types";

/**
 * Not-found page, Battle analysis copy (analysis.ts) and terms used on several L2 screens (lane L2).
 * Format (scripts/check-i18n.mjs parses it): ONE entry per line, both sides double-quoted JSON strings:
 *   "English text exactly as in t(\"...\")": "Manglish text",
 * Keep {placeholders}, digits and RM amounts identical. Read ../GLOSSARY.md first.
 */
export const misc: Dict = {
  "This page doesn't exist": "Alamak, page ni takde",
  "Back home": "Balik home",
  "Landed": "Landed",
  "High-rise": "High-rise",
  "Guarded-community fee": "Fee komuniti berpengawal",
  "Est. guard and landscaping fee": "Anggaran fee guard dan landskap",
  "Monthly": "Bulanan",
  "Commute": "Perjalanan ke office",
  "Space": "Ruang",
  "Value": "Nilai",
  "Ready": "Siap",
  "Hours on the road or train count most.": "Jam atas jalan atau train paling penting.",
  "Most space / family": "Paling luas / family",
};
