"use client";

import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pct, type locations } from "@/lib/homelander/admin-metrics";
import { Badge } from "@/components/ui/badge";
import { axis, ChartFigure, Empty, Meter, Panel, Section, tooltip } from "./kit";

const modeColor = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export function Location({ data }: { data: ReturnType<typeof locations> }) {
  const { n, areaRows, workRows, modes, avgMax, unserved } = data;
  const top = unserved[0];
  const maxShare = Math.max(...areaRows.map((r) => r.share), 0.01);
  const work = workRows.slice(0, 8).map((w) => ({ name: w.name.replace(/ \/.*$/, "").replace(" (Uptown)", ""), share: Math.round(w.share * 1000) / 10 }));
  const pie = modes.filter((m) => m.buyers > 0).map((m) => ({ name: m.label, value: m.buyers, fill: modeColor[modes.indexOf(m)] }));
  return (
    <Section
      id="location"
      title="Where buyers want to live vs where they work"
      purpose="Areas buyers ask Mochi for, where they work and how they get there. Areas with demand but no Gamuda project are land-bank candidates."
      audience="land planning and management"
      takeaway={
        top ? (
          <>
            Where to build next: <strong>{unserved.slice(0, 3).map((u) => u.name).join(", ")}</strong>. {top.name} alone is wanted by {pct(top.share)} of buyers (most work in {top.topWork}) and we
            have no selling project there.
          </>
        ) : undefined
      }
    >
      {!n ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Preferred areas" note={`% of ${n.toLocaleString("en-MY")} onboarded buyers`}>
            <ul className="grid gap-2.5">
              {areaRows.slice(0, 12).map((r) => (
                <li key={r.name} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3rem] items-center gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_3rem_7.5rem]">
                  <span className="truncate">{r.name}</span>
                  <Meter value={r.share} max={maxShare} color={r.supplied ? "var(--chart-1)" : "var(--chart-3)"} />
                  <span className="text-right tabular-nums">{pct(r.share)}</span>
                  <span className="col-span-3 sm:col-span-1">
                    {r.supplied ? (
                      <Badge variant="outline" className="max-w-full truncate" title={r.projects.join(", ")}>
                        {r.projects[0]}
                        {r.projects.length > 1 ? ` +${r.projects.length - 1}` : ""}
                      </Badge>
                    ) : (
                      <Badge className="border-transparent bg-[color-mix(in_oklch,var(--chart-3)_18%,transparent)] text-foreground">No Gamuda project</Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <div className="grid grid-cols-1 gap-4">
            <Panel title="Where buyers work" note="% of onboarded buyers">
              <ChartFigure label="Buyers' workplaces, share of onboarded buyers" columns={["Workplace", "Share %"]} rows={work.map((w) => [w.name, w.share])} className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={work} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                    <XAxis type="number" {...axis} unit="%" />
                    <YAxis type="category" dataKey="name" {...axis} width={120} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <Tooltip {...tooltip} formatter={(v) => [`${v}%`, "Buyers"]} />
                    <Bar dataKey="share" name="Buyers" fill="var(--chart-2)" radius={[0, 4, 4, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFigure>
            </Panel>
            <Panel title="How they commute" note={`Avg acceptable one-way: ${Math.round(avgMax)} min`}>
              <div className="grid items-center gap-4 sm:grid-cols-[9rem_1fr]">
                <ChartFigure label="Commute mode split" columns={["Mode", "Buyers"]} rows={pie.map((p) => [p.name, p.value])} className="mx-auto size-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pie} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="100%" paddingAngle={2} cornerRadius={4} stroke="var(--card)" />
                      <Tooltip {...tooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartFigure>
                <ul className="grid gap-2 text-sm">
                  {modes.map((m, i) => (
                    <li key={m.mode} className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: modeColor[i] }} aria-hidden />
                      <span className="flex-1">{m.label}</span>
                      <span className="tabular-nums">{pct(m.share)}</span>
                      <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">{m.buyers ? `≤ ${Math.round(m.avgMax)} min OK` : "–"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </div>
        </div>
      )}
    </Section>
  );
}
