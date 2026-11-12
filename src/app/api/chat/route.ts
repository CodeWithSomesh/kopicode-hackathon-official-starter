import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { env, isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Streaming AI endpoint via the Vercel AI Gateway (one key, any model).
 * - On Vercel: works with the project's OIDC token once AI Gateway is enabled.
 * - Locally: set AI_GATEWAY_API_KEY in .env.local (or run `vercel env pull`).
 * Change the model with AI_MODEL, e.g. "openai/gpt-5" or "anthropic/claude-sonnet-5.5".
 */
const SYSTEM_PROMPT = `You are the in-app assistant for this product.
Be concise and practical. Use short paragraphs and bullet points.
(Replace this prompt with one specific to the problem statement.)`;

export async function POST(req: Request) {
  // Protect credits: only signed-in users can call the model (unless demo mode).
  if (!isDemoMode) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: env.aiModel,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
