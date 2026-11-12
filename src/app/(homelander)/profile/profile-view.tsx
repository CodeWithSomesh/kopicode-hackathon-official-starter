"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { rm, unitById } from "@/lib/homelander/data";
import { useT } from "@/lib/homelander/i18n/client";
import { homelander, useHomeLander } from "@/lib/homelander/store";

export function ProfileView() {
  const t = useT();
  const s = useHomeLander();
  const router = useRouter();
  // What Mochi heard in onboarding, falling back to the older quick-answers card.
  const officeDays = s.profile.officeDays ?? s.answers?.officeDays;
  const mode = s.profile.commuteMode ?? s.answers?.mode;
  const rows: [string, string][] = [
    [t("Homes liked"), String(s.liked.length)],
    [t("Bank estimate"), s.budget ? t("Up to {amount}", { amount: rm(s.budget.maxPriceRM) }) : t("Not checked yet")],
    [t("Office days"), officeDays !== undefined ? t("{n} a week", { n: officeDays }) : t("Ask Mochi")],
    [t("Gets to work by"), mode ? (mode === "train" ? t("Train") : mode === "mixed" ? t("Car + train") : t("Car")) : t("Ask Mochi")],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-2 lg:col-span-2">
        <h1 className="font-pixel text-3xl font-bold">{t("Your profile")}</h1>
        <p className="text-ink-soft">{t("What Mochi knows about you. Change it any time by chatting with Mochi again.")}</p>
      </div>
      <PixPanel className="grid gap-3 p-5">
        <h2 className="font-pixel text-xl font-bold">{t("Your answers")}</h2>
        <dl className="grid gap-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-t-2 border-ink/10 pt-2">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-3">
          <PixButton asChild tone="pandan" size="sm">
            <Link href="/onboarding">{t("Chat with Mochi again")}</Link>
          </PixButton>
          <PixButton
            size="sm"
            onClick={() => {
              if (!window.confirm(t("Clear your answers, likes and bank estimate, and start fresh with Mochi?"))) return;
              homelander.reset();
              router.push("/onboarding");
            }}
          >
            {t("Start over")}
          </PixButton>
        </div>
      </PixPanel>
      <PixPanel className="grid gap-3 p-5">
        <h2 className="font-pixel text-xl font-bold">{t("Shortlist")}</h2>
        {s.liked.length ? (
          <ul className="grid gap-2 text-sm">
            {s.liked.map((id) => (
              <li key={id} className="flex justify-between gap-4">
                <span>{unitById[id]?.name ?? id}</span>
                <span className="text-ink-soft tabular-nums">{unitById[id] ? rm(unitById[id].priceRM) : ""}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">{t("No homes yet. Swipe to build your shortlist.")}</p>
        )}
      </PixPanel>
    </div>
  );
}
