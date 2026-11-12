import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { AGENT_UID, AgoraError, agoraAppId, agoraConfigured, agoraMixedLanguages, agoraSetup, joinAgent, rtcToken, type CallLang } from "@/lib/homelander/agora";
import { mochiPersonaForVoice } from "@/lib/homelander/mochi-brain";
import { filledKeys, profileSchema, type Profile } from "@/lib/homelander/profile";

export const dynamic = "force-dynamic";

const Body = z.object({ profile: profileSchema, lang: z.enum(["en", "ms", "zh", "ta"]).default("en") });

/** Mochi's first line, in the language the buyer picked for the call. */
const GREETING: Record<CallLang, { first: string; back: string }> = {
  en: {
    first: "Hi, I'm Mochi! I'll help you find a home that fits your life. So, who will you be living with?",
    back: "Hi, it's Mochi again! Let's pick up where we left off.",
  },
  ms: {
    first: "Hai, saya Mochi! Saya akan bantu anda cari rumah yang sesuai dengan hidup anda. Jadi, anda akan tinggal dengan siapa?",
    back: "Hai, Mochi lagi! Jom sambung dari tadi.",
  },
  zh: {
    first: "你好，我是Mochi！我会帮你找到适合你生活的房子。请问，你会和谁一起住呢？",
    back: "你好，又是Mochi！我们接着刚才的聊吧。",
  },
  ta: {
    first: "வணக்கம், நான் Mochi! உங்கள் வாழ்க்கைக்கு ஏற்ற வீட்டைக் கண்டுபிடிக்க உதவுவேன். நீங்கள் யாருடன் வசிக்கப் போகிறீர்கள்?",
    back: "வணக்கம், மீண்டும் Mochi! விட்ட இடத்திலிருந்து தொடரலாம்.",
  },
};

function greeting(profile: Profile, lang: CallLang, mixed: boolean) {
  const line = filledKeys(profile).length ? GREETING[lang].back : GREETING[lang].first;
  // Only a mixed-language recogniser can follow a switch mid-call, so only then offer one.
  return mixed ? `${line} You can talk to me in English, Bahasa Melayu, Mandarin or Tamil.` : line;
}

/**
 * Starts a live call with Mochi: makes a channel, an RTC token for the buyer, and asks Agora's
 * Conversational AI Engine to put Mochi into it, with what we already know about this buyer in its
 * prompt so it skips those questions. Returns only what the browser needs to join.
 */
export async function POST(req: Request) {
  if (!agoraConfigured()) return Response.json({ error: "Live voice isn't set up" }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });
  const { profile, lang } = parsed.data;
  const mixed = agoraMixedLanguages();

  const channel = `mochi-${randomUUID().slice(0, 12)}`;
  const uid = randomInt(10_000, 2_000_000_000);

  try {
    const { agentId } = await joinAgent({
      channel,
      userUid: uid,
      systemPrompt: mochiPersonaForVoice(profile, mixed ? undefined : lang),
      greeting: greeting(profile, lang, mixed),
      lang,
    });
    console.info("[agora/start] Mochi joined", channel, agoraSetup());
    return Response.json(
      { appId: agoraAppId(), channel, uid, token: rtcToken(channel, uid), agentId, agentUid: AGENT_UID },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const status = e instanceof AgoraError ? e.status : 500;
    console.error("[agora/start]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't start the call with Mochi." }, { status: status >= 500 ? 502 : status });
  }
}
