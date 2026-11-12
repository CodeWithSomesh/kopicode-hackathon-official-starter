"use client";

import { ArrowDownIcon } from "lucide-react";
import { num, pct, type funnel } from "@/lib/homelander/admin-metrics";
import { cn } from "@/lib/utils";
import { Section } from "./kit";

const advice: Record<string, string> = {
  chat: "the landing page: make the first question to Mochi easier to start",
  swipe: "onboarding: shorten Mochi's chat or let buyers skip money questions",
  battle: "the deck: more relevant homes so buyers reach 3 likes",
  bank: "Battle: put the bank check button on the winning home",
  lead: "the bank step: a clearer \"get pre-qualified\" offer",
};

export function Funnel({ data }: { data: ReturnType<typeof funnel> }) {
  const { rows, worst, overall } = data;
  return (
    <Section
      id="funnel"
      title="Conversion funnel"
      purpose="How many visitors reach each step, and where they drop off."
      audience="marketing and product"
      takeaway={
        rows[0]!.n ? (
          <>
            <strong>{pct(overall, 1)}</strong> of visitors become a lead. The biggest drop is into <strong>{worst.label}</strong> ({pct(worst.dropOff)} lost):
            fix {advice[worst.id] ?? "this step"} first.
          </>
        ) : undefined
      }
    >
      <ol className="grid gap-2.5" aria-label="Funnel steps">
        {rows.map((r, i) => (
          <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 md:grid-cols-[11rem_minmax(0,1fr)_16rem]">
            <div className="grid leading-tight">
              <span className="text-sm font-medium">
                <span className="mr-1.5 text-muted-foreground tabular-nums">{i + 1}.</span>
                {r.label}
              </span>
              <span className="text-xs text-muted-foreground">{r.hint}</span>
            </div>
            <div className="col-span-2 row-start-2 h-8 overflow-hidden rounded-md bg-muted md:col-span-1 md:row-start-1 md:col-start-2" aria-hidden>
              <div
                className="h-full rounded-md"
                style={{
                  width: `${Math.max(r.ofTotal * 100, 0.5)}%`,
                  background: `color-mix(in oklch, var(--chart-1) ${100 - i * 12}%, var(--chart-2))`,
                }}
              />
            </div>
            <div className="flex items-center justify-end gap-2 text-xs md:justify-start">
              <span className="text-sm font-semibold tabular-nums">{num(r.n)}</span>
              {i > 0 ? (
                <>
                  <span className="text-muted-foreground tabular-nums">{pct(r.fromPrev)} continue</span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium tabular-nums",
                      r.id === worst.id ? "bg-[color-mix(in_oklch,var(--bad)_14%,transparent)] text-[var(--bad)]" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <ArrowDownIcon className="size-3" aria-hidden />
                    {pct(r.dropOff)}
                    <span className="sr-only"> drop-off</span>
                  </span>
                  <span className="hidden text-muted-foreground tabular-nums xl:inline">{pct(r.ofTotal, 1)} of all</span>
                </>
              ) : (
                <span className="text-muted-foreground">visitors</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
