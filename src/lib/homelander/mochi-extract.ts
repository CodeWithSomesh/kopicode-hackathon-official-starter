import "server-only";
import { groq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { mochiSystemPrompt, type MochiMessage } from "./mochi-brain";
import { legacyProfileKeys, profileSchema, type Profile } from "./profile";

/**
 * Listens in on a live call. On the Agora voice call Mochi's LLM only talks, so this turns the
 * running transcript into a profile patch for the form. It reuses Mochi's own system prompt (the
 * same "Rules for patch") and the same required-but-nullable wire schema as mochiTurn, but asks
 * only for the patch: no reply, so each call stays small.
 *
 * Groq's free tier allows 8,000 tokens a minute per model and the live agent itself runs on
 * openai/gpt-oss-120b, so extraction starts on other models. Override with MOCHI_EXTRACT_MODELS.
 */
const MODELS = (process.env.MOCHI_EXTRACT_MODELS || "openai/gpt-oss-20b,qwen/qwen3.8-27b,openai/gpt-oss-120b")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/** The buyer's latest answers plus the question Mochi asked before each; the profile holds the rest. */
const HISTORY = 6;

type LegacyKey = (typeof legacyProfileKeys)[number];
type WireKey = Exclude<keyof typeof profileSchema.shape, LegacyKey>;
/** Same wire shape as mochi-brain's patch: every non-legacy field, required but nullable. */
const patchWire = z.object(
  Object.fromEntries(
    Object.entries(profileSchema.shape)
      .filter(([k]) => !(legacyProfileKeys as readonly string[]).includes(k))
      .map(([k, v]) => [k, v.unwrap().nullable()]),
  ) as { [K in WireKey]: z.ZodNullable<ReturnType<(typeof profileSchema.shape)[K]["unwrap"]>> },
);

const extractSchema = z.object({
  patch: patchWire.describe("Every field the buyer stated or clearly implied in their LATEST message(s); null for everything else."),
});

const TASK = `IMPORTANT: this time you are NOT replying to the buyer. Mochi is talking to them live and has already answered.
You are only taking notes. Return "patch" for everything the buyer said in the user messages below, following "Rules for patch" above (here "LATEST message" means all the user messages below).
The transcript comes from speech recognition, so expect small mistakes and mixed languages. Assistant messages are only context: never take values from what Mochi said unless the buyer clearly confirmed it ("yes", "betul", "对").`;

/** "No other debts" in any of Mochi's languages (same rule as mochiTurn): unset loan fields become 0. */
const NO_DEBT = /\b(no (other )?(debts?|loans?|commitments?)|debt[- ]free|tiada (lagi )?(hutang|pinjaman)|takde (hutang|pinjaman)|tak ada hutang)\b|没有(其他)?(贷款|债务|欠债)|கடன் இல்லை/i;
const LOAN_FIELDS = ["carRM", "ptptnRM", "personalRM", "housingRM", "cardBalanceRM"] as const;

async function generate(model: Parameters<typeof generateText>[0]["model"], messages: MochiMessage[], profile: Profile, retries: number, groqReasoning: boolean) {
  const { output } = await generateText({
    model,
    system: `${mochiSystemPrompt(profile)}\n\n${TASK}`,
    messages,
    output: Output.object({ schema: extractSchema }),
    maxRetries: retries,
    providerOptions: groqReasoning ? { groq: { reasoningEffort: "low" } } : undefined,
  });
  return output.patch;
}

/** The profile fields the buyer just gave, validated one by one; {} when there's nothing new. */
export async function mochiExtract(transcript: MochiMessage[], profile: Profile): Promise<Partial<Profile>> {
  const messages = transcript.slice(-HISTORY);
  const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join(" ");
  if (!userText.trim()) return {};

  let raw: Record<string, unknown> | undefined;
  if (!process.env.GROQ_API_KEY) {
    raw = await generate(env.aiModel, messages, profile, 2, false);
  } else {
    let lastError: unknown;
    for (const [i, id] of MODELS.entries()) {
      const last = i === MODELS.length - 1;
      try {
        raw = await generate(groq(id), messages, profile, last ? 1 : 0, id.startsWith("openai/gpt-oss"));
        break;
      } catch (e) {
        lastError = e;
        console.warn(`[mochi-extract] ${id} failed${last ? "" : ", trying the next model"}:`, e instanceof Error ? e.message.slice(0, 160) : e);
      }
    }
    if (!raw) throw lastError;
  }

  // Same clean-up as mochiTurn: drop nulls, check each field alone, keep worries consistent.
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null) continue;
    const ok = profileSchema.shape[k as keyof Profile].safeParse(v);
    if (ok.success) patch[k] = ok.data;
  }
  if (!patch.topWorry && !profile.topWorry && Array.isArray(patch.painPoints) && patch.painPoints.length)
    patch.topWorry = patch.painPoints[0];
  if (typeof patch.topWorry === "string") {
    const all = new Set([...(profile.painPoints ?? []), ...((patch.painPoints as string[] | undefined) ?? [])]);
    if (!all.has(patch.topWorry)) patch.painPoints = [...all, patch.topWorry];
    else if (patch.painPoints) patch.painPoints = [...all];
  } else if (Array.isArray(patch.painPoints)) {
    patch.painPoints = [...new Set([...(profile.painPoints ?? []), ...patch.painPoints])];
  }
  if (NO_DEBT.test(userText)) {
    for (const f of LOAN_FIELDS) if (profile[f] === undefined && patch[f] === undefined) patch[f] = 0;
  }
  return patch as Partial<Profile>;
}
