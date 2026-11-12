"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { passReasons } from "@/lib/homelander/data";
import { num, pct, reasonAction, type townshipDemand } from "@/lib/homelander/admin-metrics";
import { axis, ChartFigure, Empty, legend, Panel, Section, tooltip } from "./kit";

export const reasonColor: Record<(typeof passReasons)[number], string> = {
  "Too far": "var(--chart-1)",
  "Too pricey": "var(--chart-4)",
  "Too small": "var(--chart-3)",
  "Not my style": "var(--chart-5)",
};

export function Passes({ data }: { data: ReturnType<typeof townshipDemand> }) {
  const rows = data.rows.filter((r) => r.reasonTotal > 0).sort((a, b) => b.reasonTotal - a.reasonTotal);
  const chart = rows.map((r) => ({
    name: r.name,
    ...Object.fromEntries(passReasons.map((p) => [p, Math.round((r.reasons[p] / r.reasonTotal) * 1000) / 10])),
  }));
  // The single strongest signal: a township losing most of its explained passes to one reason.
  let finding: { name: string; reason: (typeof passReasons)[number]; share: number } | null = null;
  for (const r of rows)
    for (const p of passReasons) {
      const s = r.reasons[p] / r.reasonTotal;
      if (r.reasonTotal >= 20 && (!finding || s > finding.share)) finding = { name: r.name, reason: p, share: s };
    }
  return (
    <Section
      id="passes"
      title="Why buyers pass"
      purpose="Reasons buyers give when they swipe left, per township, and the fix each one points to."
      audience="marketing, sales and product"
      takeaway={
        finding ? (
          <>
            <strong>{finding.name}</strong> loses {pct(finding.share)} of its explained passes to &ldquo;{finding.reason.toLowerCase()}&rdquo;. {reasonAction[finding.reason]}.
          </>
        ) : undefined
      }
    >
      {!rows.length ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel title="Pass reasons by township" note="% of passes with a reason">
            <ChartFigure
              label="Share of each pass reason by township"
              columns={["Township", ...passReasons.map((p) => `${p} %`)]}
              rows={chart.map((c) => [c.name, ...passReasons.map((p) => (c as Record<string, number | string>)[p]!)])}
              className="h-80"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap={6}>
                  <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                  <XAxis type="number" {...axis} unit="%" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} allowDataOverflow />
                  <YAxis type="category" dataKey="name" {...axis} width={128} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Tooltip {...tooltip} formatter={(v, name) => [`${v}%`, name]} />
                  <Legend {...legend} />
                  {passReasons.map((p, i) => (
                    <Bar key={p} dataKey={p} stackId="r" fill={reasonColor[p]} radius={i === passReasons.length - 1 ? [0, 4, 4, 0] : 0} maxBarSize={20} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartFigure>
          </Panel>
          <Panel title="What to do about it" note="Top reason per township">
            <ul className="grid gap-3">
              {rows.slice(0, 7).map((r) => (
                <li key={r.id} className="grid gap-1 border-b pb-3 text-sm last:border-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="size-2 rounded-full" style={{ background: reasonColor[r.topReason!] }} aria-hidden />
                      {r.topReason} · {pct(r.reasons[r.topReason!] / r.reasonTotal)} of {num(r.reasonTotal)}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{reasonAction[r.topReason!]}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </Section>
  );
}
