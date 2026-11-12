import { anchorOptions, rm, townshipById, unitById, type Unit } from "./data";
import type { Answers } from "./store";
import { oneWayMinutes } from "./verdict";

/**
 * Uncle's script: the five Regret Test questions, his code-switched lines (one voice that mixes
 * English, Bahasa Melayu and a bit of Manglish, the way people talk in a mamak), and the system
 * prompt for the live Agora agent. Shared by the page (browser voice) and /api/agora/start.
 */

export type QuestionKey = keyof Answers;

export type UncleOption = {
  value: Answers[QuestionKey];
  /** Chip label, mixed like the rest of the script. */
  label: string;
  /** Words that pick this option from speech, in English and BM. */
  words: string[];
};

export type UncleQuestion = { key: QuestionKey; line: string; short: string; options: UncleOption[] };

export const uncleQuestions: UncleQuestion[] = [
  {
    key: "kids",
    short: "Kids",
    line: "First one ah. Next five years, got plan nak ada anak or not?",
    options: [
      { value: "yes", label: "Yes, nak", words: ["yes", "ya", "yeah", "nak", "ada", "plan", "sure"] },
      { value: "maybe", label: "Maybe lah", words: ["maybe", "mungkin", "tengok", "not sure", "tak pasti"] },
      { value: "no", label: "No lah", words: ["no", "tak", "tidak", "takde", "nope", "tak nak"] },
    ],
  },
  {
    key: "parents",
    short: "Parents",
    line: "Your mak ayah, will they move in with you? Confirm or not?",
    options: [
      { value: "yes", label: "Yes, stay sekali", words: ["yes", "ya", "sekali", "confirm", "will", "move in"] },
      { value: "no", label: "No, separate", words: ["no", "tak", "tidak", "separate", "sendiri", "own"] },
    ],
  },
  {
    key: "officeDays",
    short: "Office",
    line: "How many days a week you masuk office? Two, three, or every day lah?",
    options: [
      { value: 2, label: "2 days", words: ["two", "2", "dua", "twice"] },
      { value: 3, label: "3 days", words: ["three", "3", "tiga"] },
      { value: 5, label: "Every day", words: ["five", "5", "lima", "every", "setiap", "hari-hari", "everyday"] },
    ],
  },
  {
    key: "mode",
    short: "Commute",
    line: "You drive kereta or naik train one?",
    options: [
      { value: "car", label: "Drive kereta", words: ["car", "drive", "kereta", "memandu", "driving"] },
      { value: "train", label: "Naik train", words: ["train", "mrt", "lrt", "ktm", "keretapi", "tren", "rail"] },
    ],
  },
  {
    key: "priority",
    short: "Space/time",
    line: "Last one, okay. If must choose: rumah besar sikit, or more time at home? Space or time?",
    options: [
      { value: "space", label: "More space", words: ["space", "luas", "besar", "bigger", "big", "room"] },
      { value: "time", label: "More time", words: ["time", "masa", "dekat", "near", "close", "faster"] },
    ],
  },
];

/** Short replies after each answer, so Uncle sounds like he's listening. */
export const uncleAcks = ["Okay, noted.", "Wah, good good.", "Hmm, boleh.", "Okay lah, faham.", "Steady."];

export function uncleIntro(count: number) {
  return `Eh, come, sit sit. You got ${count} homes on your list ah. Five questions only, then Uncle tell you which one you won't menyesal. Boleh?`;
}

export function uncleVerdictLine(winnerName: string, reason: string | undefined) {
  return `Okay, Uncle dah decide. ${winnerName} lah. ${reason ?? ""} Don't say Uncle never tell you.`.trim();
}

/**
 * Picks the option whose words appear in what the buyer said. The longest matching phrase wins,
 * so "tak nak" (no) beats "nak" (yes) and "not sure" (maybe) beats "no".
 */
export function matchOption(q: UncleQuestion, said: string): UncleOption | undefined {
  const text = said.toLowerCase();
  let best: { option: UncleOption; len: number } | undefined;
  for (const option of q.options) {
    for (const w of option.words) {
      const re = new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
      if (re.test(text) && (!best || w.length > best.len)) best = { option, len: w.length };
    }
  }
  return best?.option;
}

/* ---------------------------------------------------------------- live agent prompt */

export function shortlistFacts(ids: string[], anchorId: string) {
  const anchor = anchorOptions.find((a) => a.id === anchorId) ?? anchorOptions[0]!;
  return ids
    .map((id) => unitById[id])
    .filter((u): u is Unit => Boolean(u))
    .map((u) => {
      const t = townshipById[u.townshipId];
      return `- ${u.name} (${t?.name}, ${t?.area}): ${rm(u.priceRM)}, ${u.beds} bedrooms, ${u.type.toLowerCase()}, ${u.tenure.toLowerCase()}. To ${anchor.name}: about ${oneWayMinutes(u, anchorId, "car")} min by car, ${oneWayMinutes(u, anchorId, "train")} min by train, one way.`;
    });
}

export function uncleSystemPrompt(ids: string[], anchorId: string) {
  const anchor = anchorOptions.find((a) => a.id === anchorId) ?? anchorOptions[0]!;
  const facts = shortlistFacts(ids, anchorId);
  return `You are "Uncle", a warm, cheeky Malaysian kopitiam uncle inside HomeLander, a game that helps first-time buyers choose a Gamuda Land home. You are talking out loud, by voice.

HOW YOU TALK
- Code-switch naturally inside the same sentence, like a real Malaysian: mostly English, with Bahasa Melayu words and phrases (rumah, anak, mak ayah, kereta, boleh, faham, sikit, betul, tak payah) and light Manglish particles (lah, ah, one, confirm or not?). Never translate yourself or speak two separate languages; mix them.
- If the buyer speaks mostly Bahasa Melayu, lean more into BM. If mostly English, lean English.
- Keep every turn short: one or two spoken sentences, under 30 words. No lists, no markdown, no emoji, no symbols. Say "RM" amounts in words a person would say, like "six hundred forty-eight k".

YOUR JOB: THE REGRET TEST
Ask these five questions, ONE AT A TIME, in this order. Wait for the answer before the next one. Acknowledge each answer in a few words.
1. Kids in the next five years? (yes / maybe / no)
2. Will their parents move in? (yes / no)
3. How many days a week in the office? (2, 3, or every day)
4. Car or train?
5. If they must choose: more space, or more time?
If an answer is unclear, ask once more in simpler words. The buyer may also tap their answers on screen; if they say they already tapped, move on.
After all five, give your gut feel in two sentences: which home on their shortlist fits best and the one main reason (commute hours, bedrooms, or price). Then tell them the screen shows the full scores and they can book a viewing there.

THEIR SHORTLIST (sample data; commute estimates to ${anchor.name}, rush hour)
${facts.join("\n")}

RULES
- Only talk about Gamuda Land homes. Only the homes above. Never invent prices, units, promotions or availability.
- Prices and commutes are estimates from sample data; say "about".
- No financial, legal or investment advice. Do not tell them how much to borrow or whether property is a good investment. If asked, say the Bank screen has the estimate and a real banker should confirm.
- If they go off topic, bring them back kindly: "Okay okay, but back to your rumah ah."`;
}

export function uncleGreeting(count: number) {
  return `Eh, hello! Uncle here. You got ${count} homes on your list ah, five questions only and I tell you which one you won't menyesal. First one: next five years, got plan nak ada anak or not?`;
}
