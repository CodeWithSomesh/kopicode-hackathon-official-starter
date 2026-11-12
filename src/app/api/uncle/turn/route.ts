import { z } from "zod";
import { profileSchema } from "@/lib/homelander/profile";
import { getLang } from "@/lib/homelander/i18n/server";
import { translate } from "@/lib/homelander/i18n/translate";
import { uncleTurn } from "@/lib/homelander/uncle-brain";

export const maxDuration = 60;

const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2_000) }))
    .max(80),
  profile: profileSchema,
});

/** One Uncle turn for the browser-voice onboarding: his next line plus the profile fields he heard. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  const lang = await getLang(); // the EN | Manglish cookie: Uncle's default style and the error wording
  const t = (en: string) => translate(lang, en);
  try {
    return Response.json(await uncleTurn(parsed.data.messages, parsed.data.profile, lang));
  } catch (e) {
    console.error("[uncle/turn]", e);
    const noKey = !process.env.GROQ_API_KEY && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL;
    const needsCard = e instanceof Error && /credit card/i.test(e.message);
    return Response.json(
      {
        error: noKey
          ? "Uncle has no brain yet: add GROQ_API_KEY (or AI_GATEWAY_API_KEY) to .env.local and restart the dev server."
          : needsCard
            ? "Uncle's AI Gateway needs a credit card on the Vercel team before it serves requests (it unlocks the free credits)."
            : t("Uncle lost his train of thought. Try that again."),
      },
      { status: 503 },
    );
  }
}
