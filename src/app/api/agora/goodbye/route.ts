import { z } from "zod";
import { agoraConfigured, speakAgent } from "@/lib/homelander/agora";
import { detectLang, type MochiLang } from "@/lib/homelander/mochi-brain";

export const dynamic = "force-dynamic";

const Body = z.object({
  agentId: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/),
  /** The buyer's last words, so the goodbye is in their language. */
  lastUserText: z.string().max(2_000).default(""),
});

/** Mochi's last line once the form is complete; the page hangs up after it and opens the swipe deck. */
const GOODBYE: Record<MochiLang, string> = {
  en: "That's everything I need, thank you! Let me show you homes that fit you.",
  ms: "Itu sahaja yang saya perlukan, terima kasih! Jom tengok rumah yang sesuai untuk anda.",
  zh: "我需要的资料都齐了，谢谢你！现在带你去看适合你的房子吧。",
  ta: "எனக்குத் தேவையானது எல்லாம் கிடைத்துவிட்டது, நன்றி! உங்களுக்கு ஏற்ற வீடுகளைக் காட்டுகிறேன்.",
};

export async function POST(req: Request) {
  if (!agoraConfigured()) return Response.json({ error: "Live voice isn't set up" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  try {
    await speakAgent(parsed.data.agentId, GOODBYE[detectLang(parsed.data.lastUserText)]);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[agora/goodbye]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't say goodbye" }, { status: 502 });
  }
}
