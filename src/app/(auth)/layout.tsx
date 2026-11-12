import { LanguageToggle } from "@/components/homelander/language-toggle";
import type { Metadata } from "next";
import Link from "next/link";
import { MochiBot } from "@/components/homelander/mochi-bot";
import { PixPanel } from "@/components/homelander/pixel";
import { Sprite, type SpriteName } from "@/components/homelander/sprite";
import { HomeLanderThemeRoot } from "@/components/homelander/theme-root";
import { getT } from "@/lib/homelander/i18n/server";

export const metadata: Metadata = {
  title: { default: "HomeLander", template: "%s · HomeLander" },
  description: "Log in to HomeLander: find the Gamuda home that fits your life, with Mochi's help.",
};

/** i18n marker: t() is called on these at render. */
const tr = (s: string) => s;

const points: { icon: SpriteName; text: string }[] = [
  { icon: "mochi", text: tr("Chat with Mochi in English, Malay, Chinese or Tamil") },
  { icon: "house", text: tr("Swipe and battle real Gamuda Land homes") },
  { icon: "bank", text: tr("See what every bank will lend you") },
];

function Wordmark({ label }: { label: string }) {
  return (
    <Link href="/" aria-label={label} className="inline-block">
      <PixPanel flat className="flex items-center gap-2 px-2.5 py-1.5">
        <Sprite art="heart" scale={3} className="text-raya" />
        <span className="font-pixel text-xl leading-none font-bold tracking-wide">HOMELANDER</span>
      </PixPanel>
    </Link>
  );
}

/** HomeLander's sign-in pages: Mochi and the pitch on the left (top on phones), the form card on the right. */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getT();
  return (
    <HomeLanderThemeRoot className="min-h-svh">
      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 pt-4 pb-[20vh] lg:px-8 lg:pt-6">
        <header className="flex items-center justify-between gap-3">
          <Wordmark label={t("HomeLander, back to the map")} />
          <div className="flex items-center gap-2">
            <LanguageToggle />
          <PixPanel asChild flat>
            <Link href="/" aria-label={t("Back to the map")} className="px-3 py-2 text-sm font-semibold whitespace-nowrap">
              <span className="max-[374px]:hidden">{t("Back to the map")}</span>
              <span className="min-[375px]:hidden">{t("Map")}</span>
            </Link>
          </PixPanel>
          </div>
        </header>

        <main className="grid flex-1 grid-cols-[minmax(0,1fr)] items-center gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-12 lg:pt-10">
          {/* Phone: compact Mochi beside the pitch. */}
          <div className="flex items-center gap-3 lg:hidden">
            <MochiBot state="idle" size={76} label="" className="shrink-0" />
            <p className="font-pixel text-lg leading-snug text-ink">
              {t("Find the Gamuda home that fits your life. Mochi will help.")}
            </p>
          </div>

          {/* Desktop: the friendly panel. */}
          <PixPanel tone="sky" className="hidden gap-7 p-8 lg:grid xl:p-10">
            <div className="flex items-end gap-6">
              <MochiBot state="happy" size={168} className="shrink-0" />
              <p className="pb-4 font-pixel text-3xl leading-tight text-ink xl:text-4xl">
                {t("Find the Gamuda home that fits your life. Mochi will help.")}
              </p>
            </div>
            <ul className="grid gap-3">
              {points.map((p) => (
                <li key={p.icon} className="flex items-center gap-3">
                  <PixPanel flat className="flex size-11 shrink-0 items-center justify-center">
                    <Sprite art={p.icon} scale={3} className="text-ink" />
                  </PixPanel>
                  <span className="text-base font-medium text-ink">{t(p.text)}</span>
                </li>
              ))}
            </ul>
          </PixPanel>

          <div className="w-full max-w-[460px] justify-self-center lg:justify-self-end">{children}</div>
        </main>
      </div>
    </HomeLanderThemeRoot>
  );
}
