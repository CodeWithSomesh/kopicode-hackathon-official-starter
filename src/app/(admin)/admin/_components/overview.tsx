"use client";

import { Area, AreaChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num, pct, rmCompact, type Kpi, type trend } from "@/lib/homelander/admin-metrics";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import { axis, ChartFigure, Delta, legend, Section, tooltip } from "./kit";

const fmtKpi = (k: Kpi) => (k.kind === "rate" ? pct(k.value, 1) : k.kind === "money" ? rmCompact(k.value) : num(k.value));
const fmtPrev = (k: Kpi) => (k.kind === "rate" ? pct(k.prev, 1) : k.kind === "money" ? rmCompact(k.prev) : num(k.prev));

function KpiSpark({ k, i }: { k: Kpi; i: number }) {
  const data = k.series.map((v, x) => ({ x, v }));
  const id = `kpi-fill-${i}`;
  return (
    <div className="-mx-4 -mb-4 h-12" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke="var(--chart-1)" strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KpiRow({ items, days }: { items: Kpi[]; days: number }) {
  return (
    <section id="overview" aria-labelledby="overview-title" className="scroll-mt-20">
      <h2 id="overview-title" className="sr-only">
        Key numbers, last {days} days
      </h2>
      <Card className="gap-0 overflow-hidden py-0">
        <dl className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          {items.map((k, i) => (
            <div key={k.id} className={cn("flex min-w-0 flex-col gap-1.5 overflow-hidden bg-card p-4")}>
              <dt className="text-xs font-medium text-muted-foreground">{k.label}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{fmtKpi(k)}</span>
                <Delta value={k.delta} kind={k.kind === "rate" ? "rate" : "count"} />
              </dd>
              <dd className="text-xs text-muted-foreground">
                {k.note}
                <span className="sr-only">. Previous period: {fmtPrev(k)}.</span>
              </dd>
              <dd className="mt-auto pt-1">
                <KpiSpark k={k} i={i} />
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </section>
  );
}

export function TrendChart({ rows, days }: { rows: ReturnType<typeof trend>; days: number }) {
  const t = useT();
  const totalV = rows.reduce((a, r) => a + r.visitors, 0);
  const totalL = rows.reduce((a, r) => a + r.leads, 0);
  return (
    <Section
      id="trend"
      title="Traffic and leads over time"
      purpose={t("Visitors, completed onboardings and leads per {unit}: spot campaign spikes and whether leads keep up with traffic.", { unit: days === 90 ? t("week") : t("day") })}
      audience="marketing and management"
    >
      <ChartFigure
        label={`Visitors, onboarded buyers and leads per ${days === 90 ? "week" : "day"}. Total ${num(totalV)} visitors and ${num(totalL)} leads.`}
        columns={["Period", "Visitors", "Onboarded", "Leads"]}
        rows={rows.map((r) => [r.label, r.visitors, r.onboarded, r.leads])}
        className="h-72"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="fill-visitors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fill-onb" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...axis} tickMargin={8} minTickGap={24} />
            <YAxis yAxisId="l" {...axis} allowDecimals={false} width={44} />
            <YAxis yAxisId="r" orientation="right" {...axis} allowDecimals={false} width={32} />
            <Tooltip {...tooltip} />
            <Legend {...legend} />
            <Area yAxisId="l" type="monotone" dataKey="visitors" name="Visitors" stroke="var(--chart-1)" strokeWidth={2} fill="url(#fill-visitors)" />
            <Area yAxisId="l" type="monotone" dataKey="onboarded" name="Onboarded" stroke="var(--chart-2)" strokeWidth={2} fill="url(#fill-onb)" />
            <Line yAxisId="r" type="monotone" dataKey="leads" name="Leads (right axis)" stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFigure>
    </Section>
  );
}
