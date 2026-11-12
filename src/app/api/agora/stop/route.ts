import { z } from "zod";
import { agoraConfigured, leaveAgent } from "@/lib/homelander/agora";

export const dynamic = "force-dynamic";

const Body = z.object({ agentId: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/) });

/** Removes Uncle from the channel. Safe to call twice; Agora also drops him after the idle timeout. */
export async function POST(req: Request) {
  if (!agoraConfigured()) return Response.json({ ok: true });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  try {
    await leaveAgent(parsed.data.agentId);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[agora/stop]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't stop the agent" }, { status: 502 });
  }
}
