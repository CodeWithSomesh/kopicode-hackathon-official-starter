"use client";

import Link from "next/link";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { rm, unitById } from "@/lib/homelander/data";
import { useT } from "@/lib/homelander/i18n/client";
import { useHomeLander } from "@/lib/homelander/store";

export function ProfileView() {
  const t = useT();
  const s = useHomeLander();
  const rows: [string, string][] = [
    [t("Homes liked"), String(s.liked.length)],
    [t("Bank estimate"), s.budget ? t("Up to {amount}", { amount: rm(s.budget.maxPriceRM) }) : t("Not checked yet")],
    [t("Office days"), s.answers ? t("{n} a week", { n: s.answers.officeDays }) : t("Ask Uncle")],
    [t("Gets to work by"), s.answers ? (s.answers.mode === "train" ? t("Train") : t("Car")) : t("Ask Uncle")],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-2 lg:col-span-2">
        <h1 className="font-pixel text-3xl font-bold">{t("Your profile")}</h1>
        <p className="text-ink-soft">{t("What Uncle knows about you. Change it any time by chatting with him again.")}</p>
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
        <PixButton asChild tone="pandan" size="sm" className="justify-self-start">
          <Link href="/onboarding">{t("Chat with Uncle again")}</Link>
        </PixButton>
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
