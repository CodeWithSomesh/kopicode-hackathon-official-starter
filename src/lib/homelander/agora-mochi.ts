import { anchorOptions, rm, townshipById, unitById, type Unit } from "./data";
import type { Answers } from "./store";
import { oneWayMinutes } from "./verdict";

/**
 * Mochi's script: the five Regret Test questions, its friendly lines (clear English with the odd
 * Bahasa Melayu word, the way Malaysians talk) and the system prompt for the live Agora agent. Shared by the page (browser voice) and /api/agora/start.
 */

export type QuestionKey = keyof Answers;

export type MochiOption = {
  value: Answers[QuestionKey];
  /** Chip label, mixed like the rest of the script. */
  label: string;
  /** Words that pick this option from speech, in English and BM. */
  words: string[];
};

export type MochiQuestion = { key: QuestionKey; line: string; short: string; options: MochiOption[] };

export const mochiQuestions: MochiQuestion[] = [
  {
    key: "kids",
    short: "Kids",
    line: "First question. In the next five years, are you planning to have kids?",
    options: [
      { value: "yes", label: "Yes", words: ["yes", "ya", "yeah", "nak", "ada", "plan", "sure"] },
      { value: "maybe", label: "Maybe", words: ["maybe", "mungkin", "tengok", "not sure", "tak pasti"] },
      { value: "no", label: "No", words: ["no", "tak", "tidak", "takde", "nope", "tak nak"] },
    ],
  },
  {
    key: "parents",
    short: "Parents",
    line: "Will your parents be moving in with you?",
    options: [
      { value: "yes", label: "Yes, together", words: ["yes", "ya", "sekali", "confirm", "will", "move in"] },
      { value: "no", label: "No, separate", words: ["no", "tak", "tidak", "separate", "sendiri", "own"] },
    ],
  },
  {
    key: "officeDays",
    short: "Office",
    line: "How many days a week do you go into the office? Two, three, or every day?",
    options: [
      { value: 2, label: "2 days", words: ["two", "2", "dua", "twice"] },
      { value: 3, label: "3 days", words: ["three", "3", "tiga"] },
      { value: 5, label: "Every day", words: ["five", "5", "lima", "every", "setiap", "hari-hari", "everyday"] },
    ],
  },
  {
    key: "mode",
    short: "Commute",
    line: "Do you usually drive, or take the train?",
    options: [
      { value: "car", label: "Drive", words: ["car", "drive", "kereta", "memandu", "driving"] },
      { value: "train", label: "Train", words: ["train", "mrt", "lrt", "ktm", "keretapi", "tren", "rail"] },
    ],
  },
  {
    key: "priority",
    short: "Space/time",
    line: "Last one. If you had to choose: a bigger home, or more time at home? Space or time?",
    options: [
      { value: "space", label: "More space", words: ["space", "luas", "besar", "bigger", "big", "room"] },
      { value: "time", label: "More time", words: ["time", "masa", "dekat", "near", "close", "faster"] },
    ],
  },
];

/** Short replies after each answer, so Mochi sounds like it's listening. */
export const mochiAcks = ["Got it!", "Thanks, noted.", "That helps a lot.", "Okay, understood.", "Lovely, thank you."];

export function mochiIntro(count: number) {
  return `Hi, I'm Mochi! You have ${count} homes on your list. Five quick questions, then I'll show you the one you're least likely to regret. Ready?`;
}

export function mochiVerdictLine(winnerName: string, reason: string | undefined) {
  return `Thank you! My pick for you is ${winnerName}. ${reason ?? ""}`.trim();
}

/**
 * Picks the option whose words appear in what the buyer said. The longest matching phrase wins,
 * so "tak nak" (no) beats "nak" (yes) and "not sure" (maybe) beats "no".
 */
export function matchOption(q: MochiQuestion, said: string): MochiOption | undefined {
  const text = said.toLowerCase();
  let best: { option: MochiOption; len: number } | undefined;
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

export function mochiSystemPrompt(ids: string[], anchorId: string) {
  const anchor = anchorOptions.find((a) => a.id === anchorId) ?? anchorOptions[0]!;
  const facts = shortlistFacts(ids, anchorId);
  return `You are Mochi, a friendly, gentle helper bot inside HomeLander, an app that helps first-time buyers choose a Gamuda Land home. You are talking out loud, by voice.

HOW YOU TALK
- Warm, calm, encouraging and professional, with a touch of cuteness ("Got it!", "That helps a lot"). No slang interjections, no teasing.
- Speak clear Malaysian English. If the buyer speaks mostly Bahasa Melayu, reply in Bahasa Melayu; if they switch language, you switch too.
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
- If they go off topic, bring them back kindly: "Happy to help with that later. Shall we get back to your new home?"`;
}

export function mochiGreeting(count: number) {
  return `Hi, I'm Mochi! You have ${count} homes on your list. Five quick questions and I'll tell you which one fits you best. First: in the next five years, are you planning to have kids?`;
}
