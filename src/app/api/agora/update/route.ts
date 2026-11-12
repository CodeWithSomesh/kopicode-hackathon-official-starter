import { z } from "zod";
import { agoraConfigured, updateAgentPrompt } from "@/lib/homelander/agora";
import { mochiPersonaForVoice } from "@/lib/homelander/mochi-brain";
import { profileSchema } from "@/lib/homelander/profile";

export const dynamic = "force-dynamic";

const Body = z.object({
  agentId: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/),
  profile: profileSchema,
  /** The call's language when the recogniser hears only one; omitted on a mixed-language call. */
  lang: z.enum(["en", "ms", "zh", "ta"]).optional(),
});

/**
 * Mid-call: gives Mochi the latest profile (what's known, what's still missing) so it doesn't ask
 * again for something the form already holds. Agora "update" replaces llm.system_messages.
 * https://docs.agora.io/en/api-reference/api-ref/conversational-ai/update
 */
export async function POST(req: Request) {
  if (!agoraConfigured()) return Response.json({ error: "Live voice isn't set up" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  try {
    await updateAgentPrompt(parsed.data.agentId, mochiPersonaForVoice(parsed.data.profile, parsed.data.lang));
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[agora/update]", e instanceof Error ? e.message : e);
    return Response.json({ error: "Couldn't update Mochi" }, { status: 502 });
  }
}
