"use client";

import Link from "next/link";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { useT } from "@/lib/homelander/i18n/client";

/** The first-screen call to action. The caller hides it while a township panel or a tower is open. */
export function PitchCard() {
  const t = useT();
  return (
    <PixPanel
      aria-label={t("Start with Uncle")}
      className="pointer-events-auto absolute inset-x-3 bottom-[132px] z-10 grid gap-2.5 p-3 lg:inset-x-auto lg:bottom-6 lg:left-[328px] lg:w-80"
    >
      <p className="flex items-start gap-2 font-pixel text-base leading-tight font-bold">
        <Sprite art="uncle" scale={3} className="mt-0.5 shrink-0 text-ink" />
        {t("Find the Gamuda home that fits your life. Uncle will help.")}
      </p>
      <PixButton asChild size="md" style={{ "--pix-fill": "var(--color-raya-deep)" } as React.CSSProperties} className="text-white">
        <Link href="/login">{t("Start with Uncle")}</Link>
      </PixButton>
    </PixPanel>
  );
}
