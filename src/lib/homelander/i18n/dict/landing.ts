import type { Dict } from "./types";

/**
 * Landing page overlays: _landing/*, find-client (lane L3).
 * Format (scripts/check-i18n.mjs parses it): ONE entry per line, both sides double-quoted JSON strings:
 *   "English text exactly as in t(\"...\")": "Manglish text",
 * Keep {placeholders}, digits and RM amounts identical. Read ../GLOSSARY.md first.
 */
export const landing: Dict = {
  "Find the Gamuda home that fits your life. Uncle will help.": "Cari home Gamuda yang sesuai dengan life you. Uncle akan tolong.",
  "Close township panel": "Tutup panel township",
  "The glass block on the map is an illustrative block at Gamuda Cove (made-up units and prices). Tap a block to open it up.": "Block kaca kat map ni block ilustrasi di Gamuda Cove (unit dan harga rekaan). Tap block untuk buka.",
  "to {name}, rush hour (estimate)": "ke {name}, waktu rush hour (anggaran)",
  "{drive} min drive or {train} min by train via {station} to {anchor}.": "{drive} min drive atau {train} min naik train melalui {station} ke {anchor}.",
  "The battle holds 3 homes. Remove one first.": "Lawan boleh muat 3 homes je. Buang satu dulu.",
  "Battle full": "Lawan penuh",
  "Add to battle": "Tambah ke lawan",
  "Battle: {n}/3 homes": "Lawan: {n}/3 homes",
  "See in deck": "Tengok dalam deck",
  "{name}, completed, resale only": "{name}, dah siap, resale only",
  "{name}, from {price}, {n} units left": "{name}, mula {price}, {n} unit tinggal",
  "Your work: {name}": "Kerja you: {name}",
  "Work": "Kerja",
  "Gamuda Land map": "Map Gamuda Land",
  "Townships around the Klang Valley. Pick one to see what's still up for grabs.": "Township sekitar Klang Valley. Pilih satu untuk tengok apa yang masih ada.",
  "Sample data": "Data sample",
  "Show all townships": "Tunjuk semua township",
  "Townships": "Township",
  "Rail drawn station to station; commute times are estimates.": "Rel dilukis dari stesen ke stesen; masa commute ialah anggaran.",
  "A kopi, hidden in the corner": "Secawan kopi, tersembunyi kat penjuru",
  "Block {block}: {floors} floors, {n} units": "Block {block}: {floors} tingkat, {n} unit",
  "{kind}: {n} landed home": "{kind}: {n} rumah landed",
  "{kind}: {n} landed homes": "{kind}: {n} rumah landed",
  "Bungalow": "Bungalow",
  "Semi-D pair": "Pasangan semi-D",
  "Terrace row": "Deretan teres",
  "Building": "Building",
  "Back to the map": "Balik ke map",
};
