import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { AGENT_UID, AgoraError, agoraAppId, agoraConfigured, joinAgent, rtcToken } from "@/lib/homelander/agora";
import { uncleGreeting, uncleSystemPrompt } from "@/lib/homelander/agora-uncle";
import { anchorOptions, unitById } from "@/lib/homelander/data";
import { getLang } from "@/lib/homelander/i18n/server";

export const dynamic = "force-dynamic";

const Body = z.object({
  ids: z.array(z.string().max(40)).min(1).max(6),
  anchorId: z.string().max(40),
});

/**
 * Starts a live Uncle session: makes a channel, an RTC token for the buyer, and asks Agora's
 * Conversational AI Engine to put Uncle (with this buyer's shortlist in his prompt) into it.
 */
export async function POST(req: Request) {
  if (!agoraConfigured()) return Response.json({ error: "Live voice isn't set up" }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  const ids = parsed.data.ids.filter((id) => unitById[id]);
  if (!ids.length) return Response.json({ error: "No known homes in the shortlist" }, { status: 400 });
  const anchorId = anchorOptions.some((a) => a.id === parsed.data.anchorId) ? parsed.data.anchorId : anchorOptions[0]!.id;

  const style = await getLang(); // EN | Manglish switch: Uncle's default voice
  const channel = `homelander-uncle-${randomUUID().slice(0, 12)}`;
  const uid = randomInt(10_000, 2_000_000_000);

  try {
    const { agentId } = await joinAgent({
      channel,
      userUid: uid,
      systemPrompt: uncleSystemPrompt(ids, anchorId, style),
      greeting: uncleGreeting(ids.length, style),
    });
    return Response.json(
      { appId: agoraAppId(), channel, uid, token: rtcToken(channel, uid), agentId, agentUid: AGENT_UID },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const status = e instanceof AgoraError ? e.status : 500;
    console.error("[agora/start]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't start Uncle's live voice" }, { status: status >= 500 ? 502 : status });
  }
}
