export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;
const STT_MODEL = process.env.GROQ_STT_MODEL ?? "whisper-large-v3";

/**
 * Words Whisper should expect. Biases spelling toward Malaysian place names and Manglish
 * without forcing a language: it still auto-detects English, Malay, Mandarin or Tamil.
 */
const VOCAB =
  "Malaysian home buyer talking to Mochi, a friendly assistant, mixing English, Bahasa Melayu, Mandarin and Tamil. lah, boleh, kan, naik LRT, naik MRT, PTPTN, EPF, KWSP, Gamuda, KLCC, KL Sentral, Bangsar South, Mid Valley, Petaling Jaya, Shah Alam, Kajang, Cyberjaya, Puchong, Klang, MRT, LRT, KTM, landed, semi-D, condo.";

/** Buyer's voice clip → text, through Groq Whisper (free tier). 503 when no Groq key is set. */
export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return Response.json({ error: "No GROQ_API_KEY" }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return Response.json({ error: "No audio" }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "Clip too long" }, { status: 413 });

  const body = new FormData();
  body.append("file", audio, audio.name || "speech.webm");
  body.append("model", STT_MODEL);
  body.append("response_format", "verbose_json");
  body.append("temperature", "0");
  body.append("prompt", VOCAB);

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body,
  });
  if (!res.ok) {
    console.error("[mochi/transcribe]", res.status, (await res.text()).slice(0, 300));
    return Response.json(
      { error: res.status === 429 ? "Mochi needs a short rest. Try again in a moment, or type." : "Mochi couldn't hear that. Try again, or type." },
      { status: 502 },
    );
  }
  const data = (await res.json()) as { text?: string; language?: string };
  return Response.json({ text: (data.text ?? "").trim(), language: data.language ?? null });
}
