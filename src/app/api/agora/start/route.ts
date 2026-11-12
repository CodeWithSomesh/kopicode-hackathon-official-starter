import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { AGENT_UID, AgoraError, agoraAppId, agoraConfigured, agoraSetup, joinAgent, rtcToken } from "@/lib/homelander/agora";
import { mochiPersonaForVoice } from "@/lib/homelander/mochi-brain";
import { filledKeys, profileSchema, type Profile } from "@/lib/homelander/profile";

export const dynamic = "force-dynamic";

const Body = z.object({ profile: profileSchema });

/** Mochi's first line on the call. Always English: the buyer hasn't spoken yet. */
function greeting(profile: Profile) {
  return filledKeys(profile).length
    ? "Hi, it's Mochi again! Let's pick up where we left off. You can talk to me in English, Bahasa Melayu, Mandarin or Tamil."
    : "Hi, I'm Mochi! I'll help you find a home that fits your life. You can talk to me in English, Bahasa Melayu, Mandarin or Tamil. So, who will you be living with?";
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
  const { profile } = parsed.data;

  const channel = `mochi-${randomUUID().slice(0, 12)}`;
  const uid = randomInt(10_000, 2_000_000_000);

  try {
    const { agentId } = await joinAgent({
      channel,
      userUid: uid,
      systemPrompt: mochiPersonaForVoice(profile),
      greeting: greeting(profile),
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
