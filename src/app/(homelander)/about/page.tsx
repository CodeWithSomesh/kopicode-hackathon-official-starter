import type { Metadata } from "next";
import { PixPanel } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { getT } from "@/lib/homelander/i18n/server";
import credits from "../../../../public/homelander/credits.json";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("About") };
}

export default async function AboutPage() {
  const t = await getT();
  const seen = new Set<string>();
  const photoCredits = credits.filter((c) => (seen.has(c.file) ? false : (seen.add(c.file), true)));

  return (
    <div className="grid gap-5">
      <h1 className="font-pixel text-3xl leading-tight font-bold">{t("About HomeLander")}</h1>
      <PixPanel className="grid gap-3 p-4 text-[15px] leading-relaxed">
        <p>
          {t(
            "HomeLander is a hackathon prototype. Every township here is a real Gamuda Land project, but the units, prices, availability, bank figures and commute times are sample data and rough estimates, not offers.",
          )}
        </p>
        <p>{t("The home photos are open-licence stand-ins from Wikimedia Commons, shown pixelated. None of them is a Gamuda project.")}</p>
      </PixPanel>
      <PixPanel className="grid gap-3 p-4">
        <h2 className="font-pixel text-xl font-bold">{t("Photo credits")}</h2>
        <ul className="grid gap-2 text-sm">
          {photoCredits.map((c) => (
            <li key={c.file}>
              <a href={c.page} target="_blank" rel="noreferrer" className="underline decoration-2 underline-offset-4">
                {c.credit}
              </a>
            </li>
          ))}
        </ul>
      </PixPanel>
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Sprite art="kopi" scale={2} />
        {t("Built over kopi at KopiCode.")}
      </p>
    </div>
  );
}
