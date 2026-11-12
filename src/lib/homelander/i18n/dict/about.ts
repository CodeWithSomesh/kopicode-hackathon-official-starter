import type { Dict } from "./types";

/**
 * About page (lane L2).
 * Format (scripts/check-i18n.mjs parses it): ONE entry per line, both sides double-quoted JSON strings:
 *   "English text exactly as in t(\"...\")": "Manglish text",
 * Keep {placeholders}, digits and RM amounts identical. Read ../GLOSSARY.md first.
 */
export const about: Dict = {
  "About HomeLander": "Pasal HomeLander",
  "HomeLander is a hackathon prototype. Every township here is a real Gamuda Land project, but the units, prices, availability, bank figures and commute times are sample data and rough estimates, not offers.": "HomeLander ni prototype hackathon. Setiap township kat sini memang projek Gamuda Land yang betul, tapi unit, harga, availability, angka bank dan masa perjalanan semua sample data dan anggaran kasar, bukan tawaran.",
  "The home photos are open-licence stand-ins from Wikimedia Commons, shown pixelated. None of them is a Gamuda project.": "Gambar rumah ni stand-in open-licence dari Wikimedia Commons, ditunjuk pixelated. Takde satu pun projek Gamuda.",
  "Photo credits": "Kredit gambar",
  "Built over kopi at KopiCode.": "Dibuat sambil minum kopi kat KopiCode.",
};
