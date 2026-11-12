"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { lenders } from "@/lib/homelander/bank";
import { num, pct, type bankInsights } from "@/lib/homelander/admin-metrics";
import { axis, ChartFigure, Empty, Meter, Panel, Section, tooltip } from "./kit";

/** What sales can do about each buyer-side blocker. */
const blockerAdvice: Record<string, string> = {
  "Debt service ratio (DSR)": "offer debt-consolidation or joint-applicant advice before the viewing",
  "Below minimum income": "steer them to banks without an income floor, or add a joint applicant",
  "Age / loan tenure": "pitch shorter tenures, a joint applicant or a bigger down payment",
  "Job tenure / documents": "tell them which payslips or Form B to bring so the bank doesn't stall",
};

const verdictColor = { likely: "var(--good)", borderline: "var(--warn)", unlikely: "var(--bad)" } as const;
const verdictLabel = { likely: "Likely", borderline: "Borderline", unlikely: "Unlikely" } as const;

export function Bank({ data }: { data: ReturnType<typeof bankInsights> }) {
  const { n, verdicts, blockers, banks, avgLikely } = data;
  const top = blockers.find((b) => b.kind === "buyer");
  const bestBank = banks[0];
  const bars = banks.map((b) => ({ name: b.name.replace(/ Bank$/, ""), share: Math.round(b.share * 1000) / 10 }));
  return (
    <Section
      id="bank"
      title="Bank eligibility insights"
      purpose="How buyers fare in the bank check: verdicts, what blocks them, and which banks say yes most often."
      audience="sales and finance partners"
      takeaway={
        n && top && bestBank ? (
          <>
            {pct(verdicts[0]!.share)} of checked buyers are likely to get a loan. The top buyer-side blocker is <strong>{top.name}</strong> ({pct(top.share)} of checks hit it at one or more banks): {blockerAdvice[top.name] ?? "address it before the viewing"}. <strong>{bestBank.name}</strong> says &ldquo;likely&rdquo; to the most buyers ({pct(bestBank.share)}): a natural partner for a joint financing campaign.
          </>
        ) : undefined
      }
    >
      {!n ? (
        <Empty>No bank checks for this filter yet.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Best verdict per buyer" note={`${num(n)} bank checks`}>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
                {verdicts.map((v) => (
                  <span key={v.verdict} style={{ width: `${v.share * 100}%`, background: verdictColor[v.verdict] }} />
                ))}
              </div>
              <ul className="grid gap-2.5 text-sm">
                {verdicts.map((v) => (
                  <li key={v.verdict} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: verdictColor[v.verdict] }} aria-hidden />
                    <span className="flex-1">{verdictLabel[v.verdict]}</span>
                    <span className="text-muted-foreground tabular-nums">{num(v.n)}</span>
                    <span className="w-12 text-right font-medium tabular-nums">{pct(v.share)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">On average {avgLikely.toFixed(1)} of {lenders.length} banks say &ldquo;likely&rdquo; per buyer.</p>
            </div>
          </Panel>
          <Panel title="Most-cited blockers" note="% of checks, any bank">
            <ul className="grid gap-3 text-sm">
              {blockers.slice(0, 7).map((b) => (
                <li key={b.name} className="grid gap-1">
                  <div className="flex justify-between gap-2">
                    <span>
                      {b.name}
                      {b.kind === "product" ? <span className="ml-1.5 text-xs text-muted-foreground">product rule</span> : null}
                    </span>
                    <span className="tabular-nums">{pct(b.share)}</span>
                  </div>
                  <Meter value={b.share} color={b.kind === "product" ? "var(--chart-5)" : "var(--bad)"} />
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Banks that qualify most buyers" note="% of checks rated likely">
            <ChartFigure label="Share of checked buyers each bank rates likely" columns={["Bank", "Likely %"]} rows={bars.map((b) => [b.name, b.share])} className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                  <XAxis type="number" {...axis} unit="%" domain={[0, 100]} />
                  <YAxis type="category" dataKey="name" {...axis} width={124} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Tooltip {...tooltip} formatter={(v) => [`${v}%`, "Rated likely"]} />
                  <Bar dataKey="share" name="Rated likely" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFigure>
          </Panel>
          <p className="text-xs text-muted-foreground lg:col-span-3">
            Verdicts from bank.ts checkAllBanks() on each buyer&apos;s income, commitments, age and target home. Bank DSR caps are SAMPLE assumptions; rates are listed, not live, quotes.
          </p>
        </div>
      )}
    </Section>
  );
}
