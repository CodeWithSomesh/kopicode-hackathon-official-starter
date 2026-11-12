import type { Dict } from "./types";

/**
 * Terms used on several screens (owned by exec-fk-5pm; ask before adding). One translation per term app-wide.
 * Format (scripts/check-i18n.mjs parses it): ONE entry per line, both sides double-quoted JSON strings:
 *   "English text exactly as in t(\"...\")": "Manglish text",
 * Keep {placeholders}, digits and RM amounts identical. Read ../GLOSSARY.md first.
 */
export const shared: Dict = {
  "Start with Uncle": "Jom chat with Uncle",
  "Ask Uncle": "Tanya Uncle",
  "Login": "Login",
  "Sign up": "Daftar",
  "Close": "Tutup",
  "Back": "Back",
  "Next": "Next",
  "Search": "Cari",
  "Filter": "Tapis",
  "Loading…": "Tunggu sat…",
  "Try again": "Cuba lagi",
  "Something went wrong": "Alamak, something wrong",
  "No results": "Alamak, tak jumpa",
  "Last unit": "Last unit, hurry lah",
  "Available": "Boleh beli",
  "Sold out": "Habis",
  "Completed, resale only": "Dah siap, resale only",
  "Nearby schools": "Sekolah dekat sini",
  "Nearby stations": "Stesen dekat sini",
  "Yes": "Ya",
  "No": "Tak",
  "Maybe": "Maybe lah",
};
