"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { rm, unitById } from "@/lib/homelander/data";
import { homelander, useHomeLander } from "@/lib/homelander/store";

export function ProfileView() {
  const s = useHomeLander();
  const router = useRouter();
  const rows: [string, string][] = [
    ["Homes liked", String(s.liked.length)],
    ["Bank estimate", s.budget ? `Up to ${rm(s.budget.maxPriceRM)}` : "Not checked yet"],
    ["Office days", s.answers ? `${s.answers.officeDays} a week` : "Ask Uncle"],
    ["Gets to work by", s.answers ? (s.answers.mode === "train" ? "Train" : "Car") : "Ask Uncle"],
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-2 lg:col-span-2">
        <h1 className="font-pixel text-3xl font-bold">Your profile</h1>
        <p className="text-ink-soft">What Uncle knows about you. Change it any time by chatting with him again.</p>
      </div>
      <PixPanel className="grid gap-3 p-5">
        <h2 className="font-pixel text-xl font-bold">Your answers</h2>
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
            <Link href="/onboarding">Chat with Uncle again</Link>
          </PixButton>
          <PixButton
            size="sm"
            onClick={() => {
              if (!window.confirm("Clear your answers, likes and bank estimate, and start fresh with Uncle?")) return;
              homelander.reset();
              router.push("/onboarding");
            }}
          >
            Start over
          </PixButton>
        </div>
      </PixPanel>
      <PixPanel className="grid gap-3 p-5">
        <h2 className="font-pixel text-xl font-bold">Shortlist</h2>
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
          <p className="text-sm text-ink-soft">No homes yet. Swipe to build your shortlist.</p>
        )}
      </PixPanel>
    </div>
  );
}
