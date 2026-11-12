import type { Dict } from "./types";

/**
 * Header, tabs, language and theme switches (owned by exec-fk-5pm).
 * Format (scripts/check-i18n.mjs parses it): ONE entry per line, both sides double-quoted JSON strings:
 *   "English text exactly as in t(\"...\")": "Manglish text",
 * Keep {placeholders}, digits and RM amounts identical. Read ../GLOSSARY.md first.
 */
export const shell: Dict = {
  "Map": "Map",
  "Swipe": "Swipe",
  "Battle": "Lawan",
  "Bank": "Bank",
  "Feng Shui": "Feng Shui",
  "Profile": "Profile",
  "Gamuda view": "Gamuda view",
  "HomeLander, back to the map": "HomeLander, balik ke map",
  "homes liked": "homes disuka",
  "About this prototype and photo credits": "Pasal prototype ni dan photo credits",
  "Language": "Bahasa",
  "Theme": "Theme",
  "Design theme: {name}. Change theme": "Theme: {name}. Tukar theme",
  "Choose a design theme": "Pilih theme",
  "Pick a look. Same screens, same data.": "Pilih rupa. Screen sama, data sama.",
  "Current": "Sekarang",
};
