import type { Dict } from "./types";

/**
 * Profile screen (lane L2).
 * Format (scripts/check-i18n.mjs parses it): ONE entry per line, both sides double-quoted JSON strings:
 *   "English text exactly as in t(\"...\")": "Manglish text",
 * Keep {placeholders}, digits and RM amounts identical. Read ../GLOSSARY.md first.
 */
export const profile: Dict = {
  "Your profile": "Profile you",
  "What Uncle knows about you. Change it any time by chatting with him again.": "Apa Uncle tahu pasal you. Nak tukar? Chat dengan dia lagi bila-bila.",
  "Your answers": "Jawapan you",
  "Homes liked": "Homes yang disuka",
  "Bank estimate": "Anggaran bank",
  "Up to {amount}": "Sampai {amount}",
  "Not checked yet": "Belum check",
  "Gets to work by": "Pergi kerja naik",
  "Chat with Uncle again": "Chat dengan Uncle lagi",
  "Shortlist": "Shortlist",
  "No homes yet. Swipe to build your shortlist.": "Belum ada homes. Swipe untuk buat shortlist.",
  "Ask Mochi": "Tanya Mochi",
  "Car + train": "Kereta + train",
  "What Mochi knows about you. Change it any time by chatting with Mochi again.": "Apa Mochi tahu pasal you. Nak tukar? Chat dengan Mochi lagi bila-bila.",
  "Chat with Mochi again": "Chat dengan Mochi lagi",
  "Clear your answers, likes and bank estimate, and start fresh with Mochi?": "Padam jawapan, suka dan anggaran bank, dan mula baru dengan Mochi?",
  "Start over": "Mula balik",
  "What worries you most about buying": "Apa paling risau pasal beli rumah",
};
