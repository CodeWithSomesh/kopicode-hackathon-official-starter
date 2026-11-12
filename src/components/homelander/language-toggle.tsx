"use client";

import { useRouter } from "next/navigation";
import { setLang, useLang, useT } from "@/lib/homelander/i18n/client";
import type { Lang } from "@/lib/homelander/i18n/config";
import { cn } from "@/lib/utils";
import { PixPanel } from "./pixel";

const options: { id: Lang; label: string }[] = [
  { id: "en", label: "EN" },
  { id: "mglish", label: "Manglish" },
];

/** "EN | Manglish" switch for the header. Client text updates at once; router.refresh() re-renders server components. */
export function LanguageToggle() {
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  return (
    <PixPanel flat className="pointer-events-auto flex h-8 items-center gap-0.5 p-0.5" role="group" aria-label={t("Language")}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={lang === o.id}
          // Language names are not translated: each reads the same in both languages.
          onClick={() => {
            if (lang === o.id) return;
            setLang(o.id);
            router.refresh();
          }}
          className={cn(
            "h-full rounded-[inherit] px-2 font-pixel text-xs max-sm:px-1.5 max-sm:text-[11px] leading-none whitespace-nowrap transition-colors",
            lang === o.id ? "bg-kaya text-ink" : "text-ink-soft hover:bg-cloud",
          )}
        >
          {o.label}
        </button>
      ))}
    </PixPanel>
  );
}
