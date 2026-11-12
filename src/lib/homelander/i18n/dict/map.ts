import type { Dict } from "./types";

/**
 * Map pins, burst, floor slider, legend, map buttons (lane L3).
 * Format (scripts/check-i18n.mjs parses it): ONE entry per line, both sides double-quoted JSON strings:
 *   "English text exactly as in t(\"...\")": "Manglish text",
 * Keep {placeholders}, digits and RM amounts identical. Read ../GLOSSARY.md first.
 */
export const map: Dict = {
  "Illustrative, made-up units and prices": "Contoh sahaja lah, unit dan harga rekaan",
};
