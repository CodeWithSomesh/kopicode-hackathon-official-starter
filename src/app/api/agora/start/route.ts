import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { AGENT_UID, AgoraError, agoraAppId, agoraConfigured, joinAgent, rtcToken } from "@/lib/homelander/agora";
import { mochiGreeting, mochiSystemPrompt } from "@/lib/homelander/agora-mochi";
import { anchorOptions, unitById } from "@/lib/homelander/data";

export const dynamic = "force-dynamic";

const Body = z.object({
  ids: z.array(z.string().max(40)).min(1).max(6),
  anchorId: z.string().max(40),
});

/**
 * Starts a live Mochi session: makes a channel, an RTC token for the buyer, and asks Agora's
 * Conversational AI Engine to put Mochi (with this buyer's shortlist in its prompt) into it.
 */
export async function POST(req: Request) {
  if (!agoraConfigured()) return Response.json({ error: "Live voice isn't set up" }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  const ids = parsed.data.ids.filter((id) => unitById[id]);
  if (!ids.length) return Response.json({ error: "No known homes in the shortlist" }, { status: 400 });
  const anchorId = anchorOptions.some((a) => a.id === parsed.data.anchorId) ? parsed.data.anchorId : anchorOptions[0]!.id;

  const channel = `homelander-mochi-${randomUUID().slice(0, 12)}`;
  const uid = randomInt(10_000, 2_000_000_000);

  try {
    const { agentId } = await joinAgent({
      channel,
      userUid: uid,
      systemPrompt: mochiSystemPrompt(ids, anchorId),
      greeting: mochiGreeting(ids.length),
    });
    return Response.json(
      { appId: agoraAppId(), channel, uid, token: rtcToken(channel, uid), agentId, agentUid: AGENT_UID },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const status = e instanceof AgoraError ? e.status : 500;
    console.error("[agora/start]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't start Mochi's live voice" }, { status: status >= 500 ? 502 : status });
  }
}
