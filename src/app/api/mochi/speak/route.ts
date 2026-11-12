import { z } from "zod";

/**
 * Mochi's voice: text → speech through CAMB AI, returned as MP3 bytes the browser plays in an
 * <audio> element. The key stays on the server. 503 when CAMB_API_KEY isn't set, so the page
 * falls back to the browser's own speechSynthesis.
 *
 * CAMB API (checked against the docs, Nov 2026):
 * - Endpoint: POST https://client.camb.ai/apis/tts-stream, header `x-api-key`, JSON body
 *   { text (3-3000 chars), language (lowercase BCP-47 locale, e.g. "ms-my"), voice_id (integer),
 *     speech_model, output_configuration: { format } }. 200 = binary audio stream
 *   (`audio/mpeg` for mp3); 422 = validation error JSON.
 *   https://docs.camb.ai/api-reference/endpoint/create-tts-stream
 *   (The older task + poll endpoint, POST /apis/tts then GET /apis/tts/{task_id}, is deprecated:
 *   https://docs.camb.ai/api-reference/endpoint/create-tts)
 * - Languages: `language` sets accent and pronunciation only, it doesn't translate. MARS 8.1 supports
 *   ms-my (Malay, Malaysia), ta-my (Tamil, Malaysia), zh-cn and en-sg; there is no en-my locale,
 *   so Malaysian English defaults to en-sg, the nearest regional English. ms-my, ta-my and en-sg
 *   are not in the mars-flash / mars-pro lists, hence the mars-8.1-flash-beta default.
 *   https://docs.camb.ai/language-support
 * - Models: https://docs.camb.ai/models (mars-8.1-flash-beta: lower latency, better accents, beta).
 * - Voice ids come from GET https://client.camb.ai/apis/list-voices (or CAMB Studio). The docs'
 *   CAMB's library has no native Malay / Malaysian-English / Malaysian-Tamil voices, so Mochi uses a
 *   friendly multilingual voice (Audrey Hayes, 144295) and the ms-my / en-sg / ta-my accent settings;
 *   Mandarin uses a native voice (Xin Xu, 171146). Override per language with CAMB_VOICE_ID_*.
 *   https://docs.camb.ai/api-reference/endpoint/list-voices
 */

export const maxDuration = 30;

const CAMB_URL = "https://client.camb.ai/apis/tts-stream";
const TIMEOUT_MS = 15_000;
const MAX_CHARS = 600;
/** The docs' default voice_id for tts-stream. */
const DOC_DEFAULT_VOICE = "144295";
/** Native voices where CAMB has a good one for Mochi's tone. */
const NATIVE_VOICE: Partial<Record<Lang, string>> = { zh: "171146" };

const langs = ["en", "ms", "zh", "ta"] as const;
type Lang = (typeof langs)[number];

const body = z.object({
  text: z.string().trim().min(1).max(MAX_CHARS),
  lang: z.enum(langs).default("en"),
});

const LOCALE_ENV: Record<Lang, string> = { en: "CAMB_LANG_EN", ms: "CAMB_LANG_MS", zh: "CAMB_LANG_ZH", ta: "CAMB_LANG_TA" };
const LOCALE_DEFAULT: Record<Lang, string> = { en: "en-sg", ms: "ms-my", zh: "zh-cn", ta: "ta-my" };
const VOICE_ENV: Record<Lang, string> = { en: "CAMB_VOICE_ID_EN", ms: "CAMB_VOICE_ID_MS", zh: "CAMB_VOICE_ID_ZH", ta: "CAMB_VOICE_ID_TA" };

function voiceFor(lang: Lang) {
  const raw = process.env[VOICE_ENV[lang]] || NATIVE_VOICE[lang] || process.env.CAMB_VOICE_ID || DOC_DEFAULT_VOICE;
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id >= 1 ? id : Number(DOC_DEFAULT_VOICE);
}

/** CAMB needs at least 3 characters; a one-word "Hi" gets a trailing beat. */
const atLeast3 = (t: string) => (t.length >= 3 ? t : `${t}...`.slice(0, 3));

export async function POST(req: Request) {
  const key = process.env.CAMB_API_KEY;
  if (!key) return Response.json({ error: "Mochi's voice isn't set up: no CAMB_API_KEY." }, { status: 503 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: `Send { text (1-${MAX_CHARS} chars), lang }.` }, { status: 400 });
  const { text, lang } = parsed.data;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const call = () =>
      fetch(CAMB_URL, {
        method: "POST",
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: atLeast3(text),
          language: process.env[LOCALE_ENV[lang]] || LOCALE_DEFAULT[lang],
          voice_id: voiceFor(lang),
          speech_model: process.env.CAMB_SPEECH_MODEL || "mars-8.1-flash-beta",
          output_configuration: { format: "mp3" },
        }),
        signal: ctrl.signal,
      });
    // CAMB's plan allows one job at a time: if the previous line is still rendering (429), wait and retry.
    let res = await call();
    for (let attempt = 1; res.status === 429 && attempt <= 3; attempt++) {
      await new Promise((r) => setTimeout(r, 700 * attempt));
      res = await call();
    }
    if (!res.ok || !res.body) {
      console.error("[mochi/speak]", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return Response.json({ error: "Mochi's voice is unavailable right now." }, { status: 502 });
    }
    // Stream CAMB's audio straight through; the timeout keeps covering the body until it ends.
    const passthrough = new TransformStream<Uint8Array, Uint8Array>({ flush: () => clearTimeout(timer) });
    void res.body.pipeTo(passthrough.writable).catch(() => clearTimeout(timer));
    return new Response(passthrough.readable, {
      headers: {
        "Content-Type": res.headers.get("content-type")?.startsWith("audio/") ? res.headers.get("content-type")! : "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    clearTimeout(timer);
    const timedOut = e instanceof Error && e.name === "AbortError";
    console.error("[mochi/speak]", timedOut ? "timed out" : e);
    return Response.json({ error: timedOut ? "Mochi's voice took too long." : "Mochi's voice is unavailable right now." }, { status: timedOut ? 504 : 502 });
  }
}
