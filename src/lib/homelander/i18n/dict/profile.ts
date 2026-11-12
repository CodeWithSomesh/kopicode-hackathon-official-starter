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
  "Office days": "Hari masuk office",
  "{n} a week": "{n} hari seminggu",
  "Gets to work by": "Pergi kerja naik",
  "Chat with Uncle again": "Chat dengan Uncle lagi",
  "Shortlist": "Shortlist",
  "No homes yet. Swipe to build your shortlist.": "Belum ada homes. Swipe untuk buat shortlist.",
};
