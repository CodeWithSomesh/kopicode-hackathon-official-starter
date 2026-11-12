import "server-only";
import { groq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { missingEssentials, profileSchema, type Profile } from "./profile";

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

export const mochiLangs = ["en", "ms", "zh", "ta"] as const;
export type MochiLang = (typeof mochiLangs)[number];

export type MochiMessage = { role: "user" | "assistant"; content: string };

/**
 * Strict structured output (Groq, OpenAI) requires every property to be listed as required,
 * so on the wire each profile field is required-but-nullable: null means "not mentioned".
 */
const patchWire = z.object(
  Object.fromEntries(
    Object.entries(profileSchema.shape).map(([k, v]) => [k, v.unwrap().nullable()]),
  ) as { [K in keyof typeof profileSchema.shape]: z.ZodNullable<ReturnType<(typeof profileSchema.shape)[K]["unwrap"]>> },
);

const turnSchema = z.object({
  reply: z.string().describe("What Mochi says out loud next. 1 to 3 short spoken sentences, one question at most."),
  lang: z.enum(mochiLangs).describe("Language of the reply: en (Malaysian English), ms, zh (Mandarin, simplified), ta (Tamil)."),
  patch: patchWire.describe("Every field the buyer stated or clearly implied in their LATEST message; null for everything else."),
  complete: z.boolean().describe("True only when nothing essential is missing and Mochi has said the wrap-up line."),
});

export type MochiTurn = { reply: string; lang: MochiLang; patch: Partial<Profile>; complete: boolean };

function systemPrompt(profile: Profile) {
  const missing = missingEssentials(profile).map((m) => `- ${m.key}: ${m.label}`);
  return `You are Mochi, a friendly helper bot who guides first-time buyers to a Gamuda Land home in the HomeLander app. You are on a voice call, so everything you say is spoken.

How you talk
- You are warm, gentle and encouraging: calm, patient and professional, with a small touch of cuteness ("Got it!", "That helps a lot", "Lovely, thank you"). You are your own character; don't imitate any film or cartoon character or quote anyone's catchphrases.
- Short: 1 to 3 short spoken sentences, at most one question per turn. No lists, no markdown, no emoji.
- Reply in the language of the buyer's latest message: English (clear Malaysian English), Bahasa Melayu, Mandarin (simplified Chinese) or Tamil. If they switch language, you switch too. Set "lang" to match.
- No slang interjections or exclamations like "Haiyaa", "Aiyo", "Walao", "Alamak" or "Fuyoh", and no teasing or roasting. Acknowledge what they shared in a few kind words, then ask the next question.
- Never judge anyone's money choices, income, debts, age, family, race, religion or gender. If the buyer sounds stressed or embarrassed, reassure them that every answer helps and there are no wrong answers.
- Be on their side: practical, never pushy, never preachy.
- Never give financial advice or promise loan approval. Money figures are only for estimates. Don't tell them to sell, cancel, refinance or pay off anything.

Your job
Collect what a home buyer must think about, conversationally, skipping anything already known:
household (who they live with, kids now or planned, parents moving in, pets), whether distance to the kids' school matters (if yes: how far is OK and how they get there: drop-off, school bus or walking; never ask which school), where they work and how many office days, partner's workplace, car or train, preferred areas and what they must be near, landed or high-rise, bedrooms, must-haves and deal-breakers, monthly gross salary (take-home if they know it), other income, joint applicant and their salary, monthly loan payments (car, PTPTN, personal loan, other home loan) and credit card balance, savings for the down payment, first home or not, age, when they want to buy, and whether a home still under construction is OK.

Rules for "patch"
- Only fields from the buyer's LATEST message. Never invent values. Every other field is null.
- Money: monthly RM numbers ("8k" = 8000, "RM 2.5k" = 2500). savingsRM and cardBalanceRM are totals, not monthly.
- If they say they have no loans of some kind, set those loan fields to 0. "No car loan" sets carRM to 0.
- livingWith: alone | partner | partner_kids | parents | friends | other. kidsPlanned: yes | maybe | no.
- preferredAreas / mustBeNear / mustHaves / dealBreakers are short phrases, e.g. "Kajang", "near MRT", "gated".
- buyWithin: 3m | 6m | 1y | 2y_plus.

Already known about this buyer (JSON):
${JSON.stringify(profile)}

Still missing:
${missing.length ? missing.join("\n") : "(nothing essential: wrap up warmly, tell them you'll show homes that fit, and set complete to true)"}

If this is the first turn and the buyer hasn't spoken yet, greet them in English, introduce yourself briefly as Mochi, here to help find a home that fits their life, and ask who they will be living with.`;
}

/** Rough language of a message: script first (Tamil, Chinese), then common Malay words. */
export function detectLang(text: string): MochiLang {
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
  const malay = text
    .toLowerCase()
    .match(/\b(saya|kami|kerja|rumah|tiada|takde|tak|dengan|dan|ada|nak|boleh|sebulan|gaji|hari|naik|simpanan|hutang|anak|isteri|suami|dekat|mahu|untuk|bilik|tahun|umur|ribu|seminggu|tinggal|bersama|pinjaman|kereta)\b/g);
  return (malay?.length ?? 0) >= 2 ? "ms" : "en";
}

const langName: Record<MochiLang, string> = { en: "English", ms: "Bahasa Melayu", zh: "Mandarin (simplified Chinese)", ta: "Tamil" };

/** "No other debts" in any of Mochi's languages: unset loan fields become 0. */
const NO_DEBT = /\b(no (other )?(debts?|loans?|commitments?)|debt[- ]free|tiada (lagi )?(hutang|pinjaman)|takde (hutang|pinjaman)|tak ada hutang)\b|没有(其他)?(贷款|债务|欠债)|கடன் இல்லை/i;
const LOAN_FIELDS = ["carRM", "ptptnRM", "personalRM", "housingRM", "cardBalanceRM"] as const;

async function generate(model: Parameters<typeof generateText>[0]["model"], messages: MochiMessage[], profile: Profile, opts: { retries: number; groqReasoning?: boolean; nudge?: string }) {
  const { output } = await generateText({
    model,
    system: systemPrompt(profile) + (opts.nudge ? `\n\nIMPORTANT: ${opts.nudge}` : ""),
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
  for (const [k, v] of Object.entries(output.patch)) {
    if (v === null) continue;
    const ok = profileSchema.shape[k as keyof Profile].safeParse(v);
    if (ok.success) patch[k] = ok.data;
  }
  // "No other debts": every loan field the buyer hasn't given yet becomes 0.
  if (lastUser && NO_DEBT.test(lastUser)) {
    for (const f of LOAN_FIELDS) if (profile[f] === undefined && patch[f] === undefined) patch[f] = 0;
  }
  return { reply: output.reply, lang: detectLang(output.reply), complete: output.complete, patch: patch as Partial<Profile> };
}
