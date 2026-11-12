import "server-only";
import { createGroq } from "@ai-sdk/groq";
import { env } from "@/lib/env";

/**
 * Models for Feng Shui Builder's AI routes. With GROQ_API_KEY set they run on Groq (fast,
 * cheap); without it they fall back to the Vercel AI Gateway like /api/chat.
 *
 * - FENG_SHUI_AI_MODEL overrides the command model.
 * - FENG_SHUI_STT_MODEL overrides the speech-to-text model.
 */

const groqKey = process.env.GROQ_API_KEY;
const groq = groqKey ? createGroq({ apiKey: groqKey }) : null;

export const provider = groq ? "groq" : "gateway";

/** Turns free text into parser commands. Needs structured (JSON schema) output. */
export const commandModel = groq
  ? groq(process.env.FENG_SHUI_AI_MODEL ?? "openai/gpt-oss-120b")
  : (process.env.FENG_SHUI_AI_MODEL ?? env.aiModel);

/** Multilingual speech-to-text; detects the language on its own. */
export const sttModel = groq
  ? groq.transcription(process.env.FENG_SHUI_STT_MODEL ?? "whisper-large-v3")
  : (process.env.FENG_SHUI_STT_MODEL ?? "openai/gpt-4o-transcribe");

/** Provider options for the speech hint, keyed by whichever provider is active. */
export const sttHint = (
  prompt: string,
): Record<string, { prompt: string }> => ({
  [groq ? "groq" : "openai"]: { prompt },
});
