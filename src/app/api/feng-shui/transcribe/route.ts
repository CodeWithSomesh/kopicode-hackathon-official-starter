import { transcribe } from "ai";
import { isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { sttHint, sttModel } from "../models";

export const maxDuration = 30;

/**
 * Speech-to-text for Feng Shui Builder's mic. Takes one short recording and returns the
 * transcript with the detected language. The model detects the language itself and keeps
 * code-switching ("letak sofa kat living room", "把 sofa 放在 living room") as spoken,
 * so the buyer never picks a language first.
 */

const MAX_BYTES = 4 * 1024 * 1024;

// Hints the spelling of local words; the model still detects the language itself.
const HINT =
  "Malaysian home buyer giving a short command about furniture and rooms. They often mix English, Bahasa Melayu, Mandarin and Tamil in one sentence. Write every word in its own script: Chinese words in Chinese characters, Tamil words in Tamil script, never spelled out by sound. Examples: 'letak sofa kat ruang tamu', 'tolong 把沙发 move to the left', '镜子 pusing sikit lah', 'tutup langsir', 'panas tak', 'betulkan', 'betulkan semua', 'fix all', 'சோபாவை move left'.";

export async function POST(req: Request) {
  // Same credit guard as /api/chat and /api/feng-shui.
  if (!isDemoMode) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub)
      return Response.json({ error: "signin" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (
    !(file instanceof Blob) ||
    !file.type.startsWith("audio/") ||
    file.size === 0 ||
    file.size > MAX_BYTES
  )
    return Response.json({ error: "bad-request" }, { status: 400 });

  try {
    const result = await transcribe({
      model: sttModel,
      audio: new Uint8Array(await file.arrayBuffer()),
      providerOptions: sttHint(HINT),
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(20_000),
    });
    return Response.json({
      text: result.text.trim(),
      language: result.language ?? null,
    });
  } catch (err) {
    console.error("[feng-shui stt]", err);
    return Response.json({ error: "stt-unavailable" }, { status: 502 });
  }
}
