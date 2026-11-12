import { timingSafeEqual } from "node:crypto";
import { ttsProxySecret } from "@/lib/homelander/agora";
import { detectLang, type MochiLang } from "@/lib/homelander/mochi-brain";

/**
 * Optional TTS for the live call: lets Agora speak with Mochi's CAMB AI voice (the same voices as
 * /api/mochi/speak) when AGORA_TTS_VENDOR=camb.
 *
 * Agora's "generic_http" TTS calls an OpenAI-compatible /audio/speech endpoint:
 *   POST { input, model?, voice?, speed, sample_rate (default 16000), response_format: "pcm", ...params }
 *   with Authorization: Bearer <tts.headers.Authorization>; the reply must be raw PCM at sample_rate,
 *   streamed with chunked transfer encoding; errors are { error: { message, type, code } }.
 *   https://docs.agora.io/en/ai/models/tts/generic-http
 *   https://docs.agora.io/en/ai/build/custom-model-integration/custom-tts
 * Agora's cloud must reach this route, so it only works on a public HTTPS deployment
 * (AGORA_PUBLIC_BASE_URL), never on localhost.
 *
 * CAMB tts-stream with output_configuration { format: "pcm_s16le", sample_rate } returns raw 16-bit
 * little-endian mono PCM: https://docs.camb.ai/api-reference/endpoint/create-tts-stream
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CAMB_URL = "https://client.camb.ai/apis/tts-stream";
const LOCALE: Record<MochiLang, string> = { en: "en-sg", ms: "ms-my", zh: "zh-cn", ta: "ta-my" };
const LOCALE_ENV: Record<MochiLang, string> = { en: "CAMB_LANG_EN", ms: "CAMB_LANG_MS", zh: "CAMB_LANG_ZH", ta: "CAMB_LANG_TA" };
const VOICE_ENV: Record<MochiLang, string> = { en: "CAMB_VOICE_ID_EN", ms: "CAMB_VOICE_ID_MS", zh: "CAMB_VOICE_ID_ZH", ta: "CAMB_VOICE_ID_TA" };
/** Same defaults as /api/mochi/speak: a cute cartoon voice, and a native Mandarin voice. */
const DEFAULT_VOICE = 147324;
const NATIVE_VOICE: Partial<Record<MochiLang, number>> = { zh: 171146 };

function voiceFor(lang: MochiLang) {
  const raw = process.env[VOICE_ENV[lang]] || process.env.CAMB_VOICE_ID;
  const id = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(id) && id >= 1 ? id : (NATIVE_VOICE[lang] ?? DEFAULT_VOICE);
}

const oaiError = (status: number, message: string) =>
  Response.json({ error: { message, type: "invalid_request_error", code: status } }, { status });

function authorised(req: Request) {
  const secret = ttsProxySecret();
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !got) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorised(req)) return oaiError(401, "Unauthorized");
  const key = process.env.CAMB_API_KEY;
  if (!key) return oaiError(503, "CAMB_API_KEY is not set");

  const body = (await req.json().catch(() => null)) as { input?: unknown; sample_rate?: unknown } | null;
  const input = typeof body?.input === "string" ? body.input.trim().slice(0, 1_000) : "";
  if (!input) return oaiError(400, "input is required");
  const rate = [8000, 16000, 22050, 24000, 44100, 48000].includes(Number(body?.sample_rate)) ? Number(body?.sample_rate) : 16000;
  const lang = detectLang(input);

  const call = () =>
    fetch(CAMB_URL, {
      method: "POST",
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.length >= 3 ? input : `${input}...`.slice(0, 3),
        language: process.env[LOCALE_ENV[lang]] || LOCALE[lang],
        voice_id: voiceFor(lang),
        speech_model: process.env.CAMB_SPEECH_MODEL || "mars-8.1-flash-beta",
        output_configuration: { format: "pcm_s16le", sample_rate: rate },
      }),
      signal: AbortSignal.timeout(20_000),
    });

  try {
    // CAMB's plan renders one job at a time; Agora may ask for the next sentence early.
    let res = await call();
    for (let attempt = 1; res.status === 429 && attempt <= 4; attempt++) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
      res = await call();
    }
    if (!res.ok || !res.body) {
      console.error("[agora/tts]", res.status, (await res.text().catch(() => "")).slice(0, 200));
      return oaiError(502, "TTS upstream failed");
    }
    // Strip a WAV header if CAMB ever sends one: Agora wants raw PCM.
    let first = true;
    const strip = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, ctl) {
        if (first && chunk.length >= 44 && String.fromCharCode(...chunk.subarray(0, 4)) === "RIFF") chunk = chunk.subarray(44);
        first = false;
        ctl.enqueue(chunk);
      },
    });
    return new Response(res.body.pipeThrough(strip), {
      headers: { "Content-Type": "audio/pcm", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[agora/tts]", e instanceof Error ? e.message : e);
    return oaiError(504, "TTS timed out");
  }
}
