import type { Metadata } from "next";
import Link from "next/link";
import { PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { getT } from "@/lib/homelander/i18n/server";
import credits from "../../../../public/homelander/credits.json";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("About") };
}

/** The buyer's path through the app, in order. */
const flow: { href: string; name: string; what: string }[] = [
  { href: "/", name: "Map", what: "Explore real Gamuda Land projects on a 3D map." },
  { href: "/login", name: "Login", what: "Sign in so your profile and likes are saved." },
  {
    href: "/onboarding",
    name: "Mochi",
    what: "Talk to Mochi, a little robot, hands-free in English, Bahasa Melayu, Mandarin or Tamil. Mochi fills in your profile only from what you actually say.",
  },
  { href: "/swipe", name: "Swipe", what: "Swipe through homes and like up to 5." },
  { href: "/battle", name: "Battle", what: "Put two homes head to head on commute, tolls and price." },
  { href: "/bank", name: "Bank", what: "See roughly what a bank may lend from your income and commitments." },
  { href: "/feng-shui", name: "Feng Shui", what: "Arrange a home's layout and check its feng shui." },
  { href: "/profile", name: "Profile", what: "Review what Mochi noted and your liked homes." },
  { href: "/admin", name: "Gamuda view", what: "A demand dashboard for Gamuda: what buyers are looking for." },
];

const tech: { name: string; what: string }[] = [
  { name: "Next.js", what: "the web app" },
  { name: "Agora Conversational AI Engine", what: "Mochi's live voice calls" },
  { name: "Groq", what: "turning what you say into profile notes" },
  { name: "Mapbox and MapLibre", what: "the map" },
  { name: "Supabase", what: "sign-in and saved data" },
];

/** "https://…/township/the-camellia" -> "The Camellia". */
const placeName = (url: string) =>
  (url.split("/").filter(Boolean).pop() ?? url)
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

export default async function AboutPage() {
  const t = await getT();

  const gamudaPages = [...new Set(credits.filter((c) => c.file.includes("/gamuda/")).map((c) => c.page))];
  const seen = new Set<string>();
  const openCredits = credits.filter(
    (c) => !c.file.includes("/gamuda/") && (seen.has(c.file) ? false : (seen.add(c.file), true)),
  );

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <h1 className="font-pixel text-3xl leading-tight font-bold">{t("About HomeLander")}</h1>

      <PixPanel className="grid gap-3 p-4 text-[15px] leading-relaxed">
        <p>
          {t(
            "HomeLander helps Malaysian home buyers find a Gamuda Land home that fits their life and budget. Mochi, a friendly robot, listens to what you need, then you swipe, compare and check your loan.",
          )}
        </p>
        <p>
          {t(
            "HomeLander is a hackathon prototype. Every township here is a real Gamuda Land project, but the units, prices, availability, bank figures and commute times are sample data and rough estimates, not offers.",
          )}
        </p>
      </PixPanel>

      <PixPanel className="grid gap-3 p-4">
        <h2 className="font-pixel text-xl font-bold">{t("How it works")}</h2>
        <ol className="grid gap-3 text-[15px] leading-relaxed">
          {flow.map((step, i) => (
            <li key={step.href} className="flex items-start gap-3">
              <PixTag tone={i === 2 ? "pandan" : "white"} className="mt-0.5 shrink-0">
                {i + 1}
              </PixTag>
              <span className="min-w-0">
                <Link href={step.href} className="font-bold underline decoration-2 underline-offset-4">
                  {t(step.name)}
                </Link>{" "}
                {t(step.what)}
              </span>
            </li>
          ))}
        </ol>
      </PixPanel>

      <PixPanel className="grid gap-3 p-4">
        <h2 className="font-pixel text-xl font-bold">{t("Built with")}</h2>
        <ul className="grid gap-2 text-[15px] leading-relaxed">
          {tech.map((x) => (
            <li key={x.name}>
              <span className="font-bold">{x.name}</span>: {t(x.what)}
            </li>
          ))}
        </ul>
      </PixPanel>

      <PixPanel className="grid gap-3 p-4">
        <h2 className="font-pixel text-xl font-bold">{t("Photo credits")}</h2>
        <p className="text-sm leading-relaxed">
          {t("Home photos © Gamuda Land, from the project pages on gamudaland.com.my:")}
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {gamudaPages.map((page) => (
            <li key={page}>
              <a href={page} target="_blank" rel="noreferrer" className="underline decoration-2 underline-offset-4">
                {placeName(page)}
              </a>
            </li>
          ))}
        </ul>
        {openCredits.length > 0 && (
          <>
            <p className="text-sm leading-relaxed">{t("Open-licence photos from Wikimedia Commons:")}</p>
            <ul className="grid gap-2 text-sm">
              {openCredits.map((c) => (
                <li key={c.file} className="break-words">
                  <a href={c.page} target="_blank" rel="noreferrer" className="underline decoration-2 underline-offset-4">
                    {c.credit}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </PixPanel>

      <PixPanel className="grid gap-2 p-4 text-sm leading-relaxed">
        <h2 className="font-pixel text-xl font-bold">{t("Map data")}</h2>
        <p>
          {t("Township locations and schools come from")}{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-2 underline-offset-4"
          >
            © OpenStreetMap
          </a>{" "}
          {t("contributors. Map tiles by")}{" "}
          <a href="https://www.mapbox.com/about/maps" target="_blank" rel="noreferrer" className="underline decoration-2 underline-offset-4">
            © Mapbox
          </a>
          ,{" "}
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="underline decoration-2 underline-offset-4">
            OpenFreeMap
          </a>{" "}
          {t("and")}{" "}
          <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer" className="underline decoration-2 underline-offset-4">
            © OpenMapTiles
          </a>
          .
        </p>
      </PixPanel>

      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Sprite art="kopi" scale={2} />
        {t("Built over kopi at KopiCode.")}
      </p>
    </div>
  );
}
