"use client";

import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pct, rmCompact, type segments } from "@/lib/homelander/admin-metrics";
import { axis, ChartFigure, Empty, Panel, Section, tooltip } from "./kit";

type Row = { name: string; buyers: number; share: number; leadRate?: number };

function MiniBars({ rows, label, color = "var(--chart-1)" }: { rows: Row[]; label: string; color?: string }) {
  const data = rows.map((r) => ({ name: r.name, share: Math.round(r.share * 1000) / 10, lead: Math.round((r.leadRate ?? 0) * 1000) / 10 }));
  return (
    <ChartFigure label={label} columns={["Group", "Share of buyers %", "Lead rate %"]} rows={data.map((d) => [d.name, d.share, d.lead])} className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="name" {...axis} interval={0} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
          <YAxis {...axis} unit="%" width={36} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
          <Tooltip {...tooltip} formatter={(v, name) => [`${v}%`, name]} />
          <Bar dataKey="share" name="Share of buyers" fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}

const groupName: Record<string, string> = {
  Single: "singles",
  Couple: "couples",
  "Family with kids": "families with kids",
  "Multi-generational": "multi-generational households",
  Sharing: "friends buying together",
};

const typeColor = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export function Segments({ data }: { data: ReturnType<typeof segments> }) {
  const { n, household, age, income, type, firstHome, size, avgSize, parentsIn, homeType, best, avgLead } = data;
  const sizeRows = size.map((r) => ({ ...r, name: r.name === "1" ? "1 person" : `${r.name}` }));
  const pie = type.filter((t) => t.buyers).map((t, i) => ({ name: t.name, value: t.buyers, fill: typeColor[i] }));
  const hh = household.map((h) => ({ ...h, name: h.name.replace("Multi-generational", "Multi-gen").replace("Family with kids", "Family") }));
  return (
    <Section
      id="segments"
      title="Buyer segments"
      purpose="Who the buyers are: household, age, income, household size and home type. Use it to pick audiences and creative."
      audience="marketing"
      takeaway={
        best ? (
          <>
            Suggested targeting: <strong>{groupName[best.household] ?? best.household} (main buyer {best.age === "Under 30" ? "under 30" : `aged ${best.age}`})</strong> turn into leads at {pct(best.leadRate, 1)} ({best.lift.toFixed(1)}× the{" "}
            {pct(avgLead, 1)} average), {pct(best.landed)} want landed and the typical one can borrow for {rmCompact(best.medianMax)}. Aim ad spend and show-unit invites at them.
          </>
        ) : undefined
      }
    >
      {!n ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Panel title="Household" note="% of buyers">
            <MiniBars rows={hh} label="Buyers by household type" />
          </Panel>
          <Panel title="Age" note="% of buyers">
            <MiniBars rows={age} label="Buyers by age band" color="var(--chart-2)" />
          </Panel>
          <Panel title="Household gross income" note="per month">
            <MiniBars rows={income} label="Buyers by household gross monthly income" color="var(--chart-5)" />
          </Panel>
          <Panel title="Buyer type" note={`${pct(firstHome)} first home`}>
            <div className="grid grid-cols-[8rem_1fr] items-center gap-4">
              <ChartFigure label="Buyers by type" columns={["Type", "Buyers"]} rows={pie.map((p) => [p.name, p.value])} className="size-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="100%" paddingAngle={2} cornerRadius={4} stroke="var(--card)" />
                    <Tooltip {...tooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartFigure>
              <ul className="grid gap-2 text-sm">
                {type.map((t, i) => (
                  <li key={t.name} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: typeColor[i] }} aria-hidden />
                    <span className="flex-1">{t.name}</span>
                    <span className="tabular-nums">{pct(t.share)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
          <Panel title="Household size" note={`${avgSize ? `${avgSize.toFixed(1)} people on average · ` : ""}${pct(parentsIn)} with parents moving in`}>
            <MiniBars rows={sizeRows} label="Buyers by number of people in the home" color="var(--chart-2)" />
          </Panel>
          <Panel title="Landed vs high-rise" note="What buyers told Mochi">
            <div className="grid gap-3">
              <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
                {homeType.map((h, i) => (
                  <span key={h.name} style={{ width: `${h.share * 100}%`, background: typeColor[i] }} />
                ))}
              </div>
              <ul className="grid gap-2 text-sm">
                {homeType.map((h, i) => (
                  <li key={h.name} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: typeColor[i] }} aria-hidden />
                    <span className="flex-1">{h.name}</span>
                    <span className="tabular-nums">{pct(h.share)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>
      )}
    </Section>
  );
}
