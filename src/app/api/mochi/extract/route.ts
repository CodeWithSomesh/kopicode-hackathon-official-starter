import { z } from "zod";
import { mochiExtract } from "@/lib/homelander/mochi-extract";
import { profileSchema } from "@/lib/homelander/profile";

export const maxDuration = 30;

const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2_000) }))
    .min(1)
    .max(40),
  profile: profileSchema,
});

/**
 * Live call note-taker: the running transcript in, only the profile patch out. The Agora voice
 * agent does the talking; this keeps the form filling as the buyer speaks.
 */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  try {
    return Response.json({ patch: await mochiExtract(parsed.data.messages, parsed.data.profile) });
  } catch (e) {
    console.error("[mochi/extract]", e instanceof Error ? e.message.slice(0, 200) : e);
    return Response.json({ error: "Couldn't read that answer", patch: {} }, { status: 503 });
  }
}
