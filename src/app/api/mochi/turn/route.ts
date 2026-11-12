import { z } from "zod";
import { profileSchema } from "@/lib/homelander/profile";
import { mochiTurn } from "@/lib/homelander/mochi-brain";

export const maxDuration = 60;

const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2_000) }))
    .max(80),
  profile: profileSchema,
});

/** One Mochi turn for the browser-voice onboarding: its next line plus the profile fields it heard. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  try {
    return Response.json(await mochiTurn(parsed.data.messages, parsed.data.profile));
  } catch (e) {
    console.error("[mochi/turn]", e);
    const noKey = !process.env.GROQ_API_KEY && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL;
    const needsCard = e instanceof Error && /credit card/i.test(e.message);
    return Response.json(
      {
        error: noKey
          ? "Mochi isn't connected yet: add GROQ_API_KEY (or AI_GATEWAY_API_KEY) to .env.local and restart the dev server."
          : needsCard
            ? "Mochi's AI Gateway needs a credit card on the Vercel team before it serves requests (it unlocks the free credits)."
            : "Mochi lost its train of thought. Please try that again.",
      },
      { status: 503 },
    );
  }
}
