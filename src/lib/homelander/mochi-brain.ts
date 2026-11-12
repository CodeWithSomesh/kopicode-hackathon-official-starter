import "server-only";
import { groq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { EVIDENCE_RULE, groundPatch } from "./grounding";
import { legacyProfileKeys, missingEssentials, painPointLabel, painPoints, profileSchema, type Profile } from "./profile";

/**
 * Mochi's brain, shared by the browser voice and the live Agora agent: one model call per turn that
 * returns what Mochi says next and every profile field the buyer just mentioned, validated against
 * the profile schema. Uses Groq (free, fast) when GROQ_API_KEY is set, else the Vercel AI Gateway.
 */

/**
 * Groq's free tier allows 8,000 tokens a minute PER MODEL and a turn costs ~2-3k, so Mochi walks
 * down this list when a model is rate-limited (or rejects the request). Override with GROQ_MODELS.
 */
const GROQ_MODELS = (process.env.GROQ_MODELS ?? process.env.GROQ_MODEL ?? "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/** Only the turns Mochi needs to stay in context; the profile JSON carries everything older. */
const HISTORY = 12;

import { detectLang, mochiLangs, type MochiLang } from "./lang";
export { detectLang, mochiLangs, type MochiLang };

export type MochiMessage = { role: "user" | "assistant"; content: string };

/**
 * Strict structured output (Groq, OpenAI) requires every property to be listed as required,
 * so on the wire each profile field is required-but-nullable: null means "not mentioned".
 */
type LegacyKey = (typeof legacyProfileKeys)[number];
type WireKey = Exclude<keyof typeof profileSchema.shape, LegacyKey>;
/** Legacy fields (kids, schools) are left off the wire, so the model can't fill them. */
const patchWire = z.object(
  Object.fromEntries(
    Object.entries(profileSchema.shape)
      .filter(([k]) => !(legacyProfileKeys as readonly string[]).includes(k))
      .map(([k, v]) => [k, v.unwrap().nullable()]),
  ) as { [K in WireKey]: z.ZodNullable<ReturnType<(typeof profileSchema.shape)[K]["unwrap"]>> },
);

/** The buyer's own words behind each patch field; fields without them are dropped (see grounding.ts). */
export const evidenceWire = z
  .array(
    z.object({
      field: z.enum(Object.keys(patchWire.shape) as [WireKey, ...WireKey[]]),
      quote: z.string().describe("The buyer's exact words, copied verbatim from a user message."),
    }),
  )
  .describe("One entry per non-null patch field: the buyer's exact words that state it.");

const turnSchema = z.object({
  reply: z.string().describe("What Mochi says out loud next. 1 to 3 short spoken sentences, ending with exactly one question unless wrapping up."),
  lang: z.enum(mochiLangs).describe("Language of the reply: en (Malaysian English), ms, zh (Mandarin, simplified), ta (Tamil)."),
  patch: patchWire.describe("Every field the buyer stated or clearly implied in their LATEST message; null for everything else."),
  evidence: evidenceWire,
  complete: z.boolean().describe("True only when nothing essential is missing and Mochi has said the wrap-up line."),
});

export type MochiTurn = { reply: string; lang: MochiLang; patch: Partial<Profile>; complete: boolean };

/** Who Mochi is and how it talks: shared by the chat brain and the live voice agent. */
const PERSONA = `How you talk
- You are warm, gentle and encouraging: calm, patient and professional, with a small touch of cuteness ("Got it!", "That helps a lot", "Lovely, thank you"). You are your own character; don't imitate any film or cartoon character or quote anyone's catchphrases.
- Short: 1 to 3 short spoken sentences ending with one question (never more), until the wrap-up. No lists, no markdown, no emoji.
- Reply in the language of the buyer's latest message: English (clear Malaysian English), Bahasa Melayu, Mandarin (simplified Chinese) or Tamil. If they switch language, you switch too.
- No slang interjections or exclamations like "Haiyaa", "Aiyo", "Walao", "Alamak" or "Fuyoh", and no teasing or roasting. Acknowledge what they shared in a few kind words, then ask the next question.
- Never judge anyone's money choices, income, debts, age, family, race, religion or gender. If the buyer sounds stressed or embarrassed, reassure them that every answer helps and there are no wrong answers.
- Be on their side: practical, never pushy, never preachy.
- Never give financial advice or promise loan approval. Money figures are only for estimates. Don't tell them to sell, cancel, refinance or pay off anything.`;

const WORRY_LIST = painPoints.map((p) => `${p} (${painPointLabel[p].toLowerCase()})`).join(", ");

const JOB = `Your job
Collect what a home buyer must think about, conversationally, skipping anything already known:
household (who they live with, how many people will live in the home, parents moving in, pets), their biggest worry or struggle about buying a home, where they work and how many office days, partner's workplace, car or train, preferred areas and what they must be near, landed or high-rise, bedrooms, must-haves and deal-breakers, monthly gross salary (take-home if they know it), other income, joint applicant and their salary, monthly loan payments (car, PTPTN, personal loan, other home loan) and credit card balance, savings for the down payment, first home or not, age, when they want to buy, and whether a home still under construction is OK.

Their worries come early
- Around your second or third question, once you know who they live with, ask what worries them most, or what their biggest struggle is, about buying a home. Many Malaysians struggle with the same things: the cash for the deposit and fees, fear the bank will reject the loan, a monthly instalment that eats the salary, hidden costs like maintenance fees and renovation, traffic jams to work, developers' delays and waiting years for keys, resale value, leasehold, safety, living near family, homes that are too small, and floods.
- When they share a worry, empathise briefly and sincerely in one short phrase (for example "That's a very real worry, many buyers feel the same"), then move on. Tell them you'll look for homes that ease it. Don't lecture and don't give advice.
- If they name several, ask nothing more about it; the first or the one they stress most is the biggest.
- After the empathy, always carry on with your next question in the same reply (unless everything is collected).

Never ask
- Never ask whether they have or plan to have kids, and never ask about schools or school distance. If they mention kids themselves, simply count them in the household size.`;

/** Mochi's full system prompt for one chat turn: persona, job, structured-patch rules and what's known. */
/** Once Mochi knows the household, the worry question comes next. */
function worryNudge(profile: Profile) {
  if (profile.topWorry || profile.painPoints?.length) return "";
  if (!profile.livingWith && !profile.householdSize)
    return "\n\nAs soon as you know who they live with (even from their latest message), your NEXT question is what worries them most, or their biggest struggle, about buying a home. Ask it before work, money or anything else.";
  return "\n\nYour NEXT question: you already know their household, so now gently ask what worries them most, or what their biggest struggle is, about buying a home. Ask this before work, money or anything else.";
}

export function mochiSystemPrompt(profile: Profile) {
  const missing = missingEssentials(profile).map((m) => `- ${m.key}: ${m.label}`);
  return `You are Mochi, a friendly helper bot who guides first-time buyers to a Gamuda Land home in the HomeLander app. You are on a voice call, so everything you say is spoken.

${PERSONA}
- Set "lang" to match the language of your reply.

${JOB}

Rules for "patch"
- Only fields from the buyer's LATEST message. Never invent values. Every other field is null.
${EVIDENCE_RULE}
- Money: monthly RM numbers ("8k" = 8000, "RM 2.5k" = 2500). savingsRM and cardBalanceRM are totals, not monthly. A worry can carry a number too: "I only saved 30k" also sets savingsRM to 30000.
- If they say they have no loans of some kind, set those loan fields to 0. "No car loan" sets carRM to 0.
- livingWith: alone | partner | partner_kids | parents | friends | other. householdSize counts everyone who will live in the home, the buyer included ("me, my wife and two kids" = 4).
- painPoints: every worry they mention, from this list: ${WORRY_LIST}. topWorry: the single biggest one (the one they stress most, else the first they say). worryNote: their worry in a few of their own words, translated to English, only when it adds something the list doesn't capture.
- Map everyday words to worries, in any language. Examples: "not enough for the deposit", "only saved 30k", "duit muka tak cukup", "stamp duty mahal" = upfront_cash. "scared bank reject", "takut loan tak lulus", "DSR too high", "CCRIS" = loan_approval. "instalment too high", "bayaran bulanan berat", "gaji habis bayar rumah" = monthly_burden. "maintenance fee mahal", "quit rent", "renovation cost" = hidden_costs. "jam teruk", "jem", "traffic", "commute too long", "塞车" = commute_traffic. "tak nak tunggu lama", "developer delay", "abandoned project", "projek terbengkalai", "want to move in fast" = build_delay. "can sell later?", "harga naik tak", "investment value" = resale_value. "leasehold", "pajakan" = leasehold_worry. "safe", "selamat", "pecah rumah", "gated and guarded" = safety_security. "near my parents", "dekat mak ayah", "kampung" family nearby = near_family. "rumah sempit", "too small", "need space" = space_too_small. "banjir", "flood" = flood_risk.
- preferredAreas / mustBeNear / mustHaves / dealBreakers are short phrases, e.g. "Kajang", "near MRT", "gated".
- buyWithin: 3m | 6m | 1y | 2y_plus.

Already known about this buyer (JSON):
${JSON.stringify(profile)}

Still missing:
${missing.length ? missing.join("\n") : "(nothing essential: wrap up warmly, tell them you'll show homes that fit, and set complete to true)"}${worryNudge(profile)}

If this is the first turn and the buyer hasn't spoken yet, greet them in English, introduce yourself briefly as Mochi, here to help find a home that fits their life, and ask who they will be living with.`;
}

/**
 * The same Mochi for a live voice agent that only talks (no JSON, no patch): persona, what to ask
 * and what's already known. Something else records the answers.
 */
export function mochiPersonaForVoice(profile: Profile, callLang?: MochiLang, replyLang?: MochiLang) {
  const missing = missingEssentials(profile).map((m) => `- ${m.label}`);
  // On a one-language call the recogniser only hears that language, so Mochi must stay in it.
  const langRule = callLang
    ? `\n\nLanguage of this call: ${langName[callLang]}. The buyer chose it before calling and the speech recogniser only understands ${langName[callLang]}. Always reply in ${langName[callLang]}, even if a line looks like another language. If they want another language, tell them kindly to hang up and pick it before calling again.`
    : "";
  const known = Object.keys(profile).length ? JSON.stringify(profile) : "(nothing yet)";
  // Set live from the buyer's words as they speak (see use-agora-call), so the next reply can't drift to English.
  const now = replyLang && !callLang ? `RIGHT NOW the buyer is speaking ${langName[replyLang]}. Your next reply MUST be entirely in ${langName[replyLang]}${replyLang === "en" ? "" : ", not English"}, unless their newest line is clearly in another language.\n\n` : "";
  return `${now}MOST IMPORTANT RULE: reply in the language of the buyer's LATEST line. 中文 → reply in Mandarin (simplified Chinese). Bahasa Melayu → reply in Malay. தமிழ் → reply in Tamil. English → English. Mixed → mix the same way. Ignore the language of your own earlier lines and of this prompt.

You are Mochi, a friendly helper bot who guides first-time buyers to a Gamuda Land home in the HomeLander app. You are talking to the buyer live on a voice call. Just talk: everything you say is spoken aloud, so never read out JSON, field names, brackets or lists.

${PERSONA}${langRule}

${JOB}

What you already know about this buyer (don't ask again):
${known}

Still to find out, roughly in this order:
${missing.length ? missing.join("\n") : "(NOTHING. Everything is known. Say ONE short goodbye in the call's language: thank them and say you're taking them to homes that fit them now. Ask no more questions; the call ends after this line.)"}${missing.length ? worryNudge(profile) : ""}

Language: answer in the language of the buyer's LATEST line, whatever language earlier lines or this prompt are in. Mandarin line → Mandarin reply; Malay → Malay; Tamil → Tamil; mixed → mix the same way.

Never ask the same thing twice. If the buyer already answered something earlier in this call, even if it isn't in the list above yet, take that answer and move on to the next item. If they don't know or won't say, accept it and move on.

If the buyer hasn't spoken yet, greet them briefly${callLang ? ` in ${langName[callLang]}` : ""}, introduce yourself as Mochi, here to help find a home that fits their life, and ask who they will be living with.`;
}

const langName: Record<MochiLang, string> = { en: "English", ms: "Bahasa Melayu", zh: "Mandarin (simplified Chinese)", ta: "Tamil" };

/** "No other debts" in any of Mochi's languages: unset loan fields become 0. */
const NO_DEBT = /\b(no (other )?(debts?|loans?|commitments?)|debt[- ]free|tiada (lagi )?(hutang|pinjaman)|takde (hutang|pinjaman)|tak ada hutang)\b|没有(其他)?(贷款|债务|欠债)|கடன் இல்லை/i;
const LOAN_FIELDS = ["carRM", "ptptnRM", "personalRM", "housingRM", "cardBalanceRM"] as const;

async function generate(model: Parameters<typeof generateText>[0]["model"], messages: MochiMessage[], profile: Profile, opts: { retries: number; groqReasoning?: boolean; nudge?: string }) {
  const { output } = await generateText({
    model,
    system: mochiSystemPrompt(profile) + (opts.nudge ? `\n\nIMPORTANT: ${opts.nudge}` : ""),
    messages: messages.length ? messages.slice(-HISTORY) : [{ role: "user", content: "(The buyer just sat down. Start.)" }],
    output: Output.object({ schema: turnSchema }),
    maxRetries: opts.retries,
    // Mochi is on a voice call: think briefly and answer fast.
    providerOptions: opts.groqReasoning ? { groq: { reasoningEffort: "low" } } : undefined,
  });
  return output;
}

export async function mochiTurn(messages: MochiMessage[], profile: Profile): Promise<MochiTurn> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content;
  const expected = lastUser ? detectLang(lastUser) : "en";

  const run = async (nudge?: string) => {
    if (!process.env.GROQ_API_KEY) return generate(env.aiModel, messages, profile, { retries: 2, nudge });
    let lastError: unknown;
    for (const [i, id] of GROQ_MODELS.entries()) {
      const last = i === GROQ_MODELS.length - 1;
      try {
        return await generate(groq(id), messages, profile, { retries: last ? 2 : 0, groqReasoning: id.startsWith("openai/gpt-oss"), nudge });
      } catch (e) {
        lastError = e;
        console.warn(`[mochi] ${id} failed, ${last ? "giving up" : "trying the next model"}:`, e instanceof Error ? e.message.slice(0, 160) : e);
      }
    }
    throw lastError;
  };

  let output = await run();
  // Models sometimes answer a Malay or Tamil message in English: check the reply itself and retry once.
  if (lastUser && detectLang(output.reply) !== expected) {
    try {
      const retry = await run(`The buyer wrote in ${langName[expected]}. Your whole reply MUST be in ${langName[expected]}, and "lang" must be "${expected}".`);
      if (detectLang(retry.reply) === expected) output = retry;
    } catch {
      // Keep the first reply rather than fail the turn.
    }
  }

  // Drop the "not mentioned" nulls and check each value on its own, so one bad field never loses the rest.
  const patch: Record<string, unknown> = {};
  const grounded = lastUser ? groundPatch(output.patch, output.evidence, lastUser) : {};
  for (const [k, v] of Object.entries(grounded)) {
    if (v === null) continue;
    const ok = profileSchema.shape[k as keyof Profile].safeParse(v);
    if (ok.success) patch[k] = ok.data;
  }
  // A list of worries without a biggest one: the first they said is the biggest.
  if (!patch.topWorry && !profile.topWorry && Array.isArray(patch.painPoints) && patch.painPoints.length)
    patch.topWorry = patch.painPoints[0];
  // The biggest worry is always one of their worries.
  if (typeof patch.topWorry === "string") {
    const all = new Set([...(profile.painPoints ?? []), ...((patch.painPoints as string[] | undefined) ?? [])]);
    if (!all.has(patch.topWorry)) patch.painPoints = [...all, patch.topWorry];
    else if (patch.painPoints) patch.painPoints = [...all];
  } else if (Array.isArray(patch.painPoints)) {
    patch.painPoints = [...new Set([...(profile.painPoints ?? []), ...patch.painPoints])];
  }
  // "No other debts": every loan field the buyer hasn't given yet becomes 0.
  if (lastUser && NO_DEBT.test(lastUser)) {
    for (const f of LOAN_FIELDS) if (profile[f] === undefined && patch[f] === undefined) patch[f] = 0;
  }
  return { reply: output.reply, lang: detectLang(output.reply), complete: output.complete, patch: patch as Partial<Profile> };
}
