import "server-only";
import { groq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { missingEssentials, profileSchema, type Profile } from "./profile";

/**
 * Uncle's brain, shared by the browser voice and the live Agora agent: one model call per turn that
 * returns what Uncle says next and every profile field the buyer just mentioned, validated against
 * the profile schema. Uses Groq (free, fast) when GROQ_API_KEY is set, else the Vercel AI Gateway.
 */

/**
 * Groq's free tier allows 8,000 tokens a minute PER MODEL and a turn costs ~2-3k, so Uncle walks
 * down this list when a model is rate-limited (or rejects the request). Override with GROQ_MODELS.
 */
const GROQ_MODELS = (process.env.GROQ_MODELS ?? process.env.GROQ_MODEL ?? "openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/** Only the turns Uncle needs to stay in context; the profile JSON carries everything older. */
const HISTORY = 12;

export const uncleLangs = ["en", "ms", "zh", "ta"] as const;
export type UncleLang = (typeof uncleLangs)[number];

export type UncleMessage = { role: "user" | "assistant"; content: string };

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
  reply: z.string().describe("What Uncle says out loud next. 1 to 3 short spoken sentences, one question at most."),
  lang: z.enum(uncleLangs).describe("Language of the reply: en (Manglish is fine), ms, zh (Mandarin, simplified), ta (Tamil)."),
  patch: patchWire.describe("Every field the buyer stated or clearly implied in their LATEST message; null for everything else."),
  complete: z.boolean().describe("True only when nothing essential is missing and Uncle has said the wrap-up line."),
});

export type UncleTurn = { reply: string; lang: UncleLang; patch: Partial<Profile>; complete: boolean };

function systemPrompt(profile: Profile) {
  const missing = missingEssentials(profile).map((m) => `- ${m.key}: ${m.label}`);
  return `You are Uncle, a warm, cheeky Malaysian kopitiam uncle who helps first-time buyers find a Gamuda Land home in the HomeLander app. You are on a voice call, so everything you say is spoken.

How you talk
- Short: 1 to 3 sentences, at most one question per turn. No lists, no markdown, no emoji.
- Reply in the language of the buyer's latest message: English (Malaysian English, a little "lah", "boleh", "can or not"), Bahasa Melayu, Mandarin (simplified Chinese) or Tamil. If they switch language, you switch too. Set "lang" to match.
- Friendly and practical, like an uncle who has seen many people buy houses. Never pushy.
- Never give financial advice or promise loan approval. Money figures are only for estimates.

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

If this is the first turn and the buyer hasn't spoken yet, greet them in English with a little Malay and ask who they will be living with.`;
}

async function generate(model: Parameters<typeof generateText>[0]["model"], messages: UncleMessage[], profile: Profile, opts: { retries: number; groqReasoning?: boolean }) {
  const { output } = await generateText({
    model,
    system: systemPrompt(profile),
    messages: messages.length ? messages.slice(-HISTORY) : [{ role: "user", content: "(The buyer just sat down. Start.)" }],
    output: Output.object({ schema: turnSchema }),
    maxRetries: opts.retries,
    // Uncle is on a voice call: think briefly and answer fast.
    providerOptions: opts.groqReasoning ? { groq: { reasoningEffort: "low" } } : undefined,
  });
  return output;
}

export async function uncleTurn(messages: UncleMessage[], profile: Profile): Promise<UncleTurn> {
  let output: z.infer<typeof turnSchema> | undefined;
  if (process.env.GROQ_API_KEY) {
    let lastError: unknown;
    for (const [i, id] of GROQ_MODELS.entries()) {
      const last = i === GROQ_MODELS.length - 1;
      try {
        output = await generate(groq(id), messages, profile, { retries: last ? 2 : 0, groqReasoning: id.startsWith("openai/gpt-oss") });
        break;
      } catch (e) {
        lastError = e;
        console.warn(`[uncle] ${id} failed, ${last ? "giving up" : "trying the next model"}:`, e instanceof Error ? e.message.slice(0, 160) : e);
      }
    }
    if (!output) throw lastError;
  } else {
    output = await generate(env.aiModel, messages, profile, { retries: 2 });
  }

  // Drop the "not mentioned" nulls and check each value on its own, so one bad field never loses the rest.
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(output.patch)) {
    if (v === null) continue;
    const ok = profileSchema.shape[k as keyof Profile].safeParse(v);
    if (ok.success) patch[k] = ok.data;
  }
  return { reply: output.reply, lang: output.lang, complete: output.complete, patch: patch as Partial<Profile> };
}
