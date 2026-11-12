"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num, pct, worryAction, type worries } from "@/lib/homelander/admin-metrics";
import { painPointShort, type PainPoint } from "@/lib/homelander/profile";
import { cn } from "@/lib/utils";
import { axis, ChartFigure, Empty, legend, Meter, Panel, Section, tooltip } from "./kit";

type Data = ReturnType<typeof worries>;

const segmentWord: Record<string, string> = { "First home": "first-home buyers", Upgrader: "upgraders", Investor: "investors" };
function segmentName(group: string, name: string) {
  if (group === "Buyer type") return segmentWord[name] ?? name;
  if (group === "Age") return name === "Under 30" ? "buyers under 30" : name === "50+" ? "buyers aged 50+" : `buyers aged ${name}`;
  return `households earning ${name} a month`;
}

/** Cell tint for a 0–1 share: stronger blue for bigger shares. */
const heat = (v: number, max: number) => `color-mix(in oklch, var(--chart-1) ${Math.round(Math.min(1, v / (max || 1)) * 55)}%, transparent)`;

/** Cell tint for a lift around 1: red below the township's average, green above. */
const lift = (x: number) => {
  const d = Math.max(-1, Math.min(1, (x - 1) / 0.6));
  return d < 0 ? `color-mix(in oklch, var(--bad) ${Math.round(-d * 40)}%, transparent)` : `color-mix(in oklch, var(--good) ${Math.round(d * 36)}%, transparent)`;
};

function Head({ worries: ws }: { worries: readonly PainPoint[] }) {
  return (
    <>
      {ws.map((w) => (
        <th key={w} scope="col" className="px-1 pb-2 align-bottom text-[11px] leading-tight font-medium text-muted-foreground">
          {painPointShort[w]}
        </th>
      ))}
    </>
  );
}

export function Worries({ data }: { data: Data }) {
  const { n, overall, bySegment, byTownship, townWorries, pick, pickLead, worst, townFlag, avgLead, avgLike } = data;
  const order = overall.map((r) => r.worry);
  const chart = overall.map((r) => ({ name: r.label, top: Math.round(r.topShare * 1000) / 10, any: Math.round(r.share * 1000) / 10 }));
  const segMax = Math.max(0, ...bySegment.flatMap((r) => Object.values(r.cells)));
  const convert = [...overall].filter((r) => r.buyers > 0).sort((a, b) => a.leadRate - b.leadRate);
  const groups = [...new Set(bySegment.map((r) => r.group))];
  const townCols = order.filter((w) => townWorries.includes(w));

  return (
    <Section
      id="worries"
      title="What buyers worry about"
      purpose="The fears buyers tell Mochi about buying a home, who has which, where they bite and how they convert. Use it to pick the message for each audience."
      audience="marketing and sales"
      takeaway={
        pick ? (
          <>
            <strong>
              {pct(pick.topShare)} of {segmentName(pick.group, pick.name)} worry most about {painPointShort[pick.top].toLowerCase()}
            </strong>{" "}
            and they turn into leads at {pct(pickLead, 1)} ({pct(avgLead, 1)} average). Suggested campaign: {worryAction[pick.top]}.
            {worst ? (
              <>
                {" "}
                Converts worst: buyers worried about <strong>{worst.label.toLowerCase()}</strong>, {pct(worst.leadRate, 1)} lead rate; for them, {worryAction[worst.worry].split(";")[0]!.replace(/^./, (c) => c.toLowerCase())}.
              </>
            ) : null}
          </>
        ) : undefined
      }
    >
      {!n ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Panel title="Top worries" note={`% of ${num(n)} onboarded buyers · 1–3 worries each`}>
              <ChartFigure
                label="Share of buyers who mention each worry, and for whom it is the biggest"
                columns={["Worry", "Biggest worry %", "Mentioned %"]}
                rows={chart.map((c) => [c.name, c.top, c.any])}
                className="h-[25rem]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap={5}>
                    <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
                    <XAxis type="number" {...axis} unit="%" />
                    <YAxis type="category" dataKey="name" {...axis} width={124} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <Tooltip {...tooltip} formatter={(v, name) => [`${v}%`, name]} />
                    <Legend {...legend} />
                    <Bar dataKey="top" name="Biggest worry" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={10} />
                    <Bar dataKey="any" name="Mentioned" fill="var(--chart-5)" radius={[0, 4, 4, 0]} maxBarSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFigure>
            </Panel>
            <Panel title="Which worries convert worst" note={`Lead rate · ${pct(avgLead, 1)} average`}>
              <table className="w-full text-sm">
                <caption className="sr-only">Like rate and lead rate of buyers with each worry, worst lead rate first</caption>
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th scope="col" className="pb-2 font-medium">
                      Buyers worried about
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Like rate
                    </th>
                    <th scope="col" className="w-[38%] pb-2 pl-3 font-medium">
                      Lead rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {convert.map((r) => (
                    <tr key={r.worry} className="border-t first:border-0">
                      <th scope="row" className="py-1.5 text-left font-normal">
                        {r.label}
                        <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{num(r.buyers)}</span>
                      </th>
                      <td className={cn("py-1.5 text-right tabular-nums", r.likeRate < avgLike * 0.85 && "text-[var(--bad)]")}>{pct(r.likeRate)}</td>
                      <td className="py-1.5 pl-3">
                        <div className="flex items-center gap-2">
                          <Meter value={r.leadRate} max={Math.max(...convert.map((c) => c.leadRate))} color={r.leadRate < avgLead ? "var(--bad)" : "var(--good)"} />
                          <span className="w-11 shrink-0 text-right tabular-nums">{pct(r.leadRate, 1)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>

          <Panel title="Biggest worry by segment" note="% of each segment · rows add up to 100%">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] table-fixed border-separate border-spacing-0.5 text-xs">
                <caption className="sr-only">Share of each buyer segment whose biggest worry is each worry</caption>
                <colgroup>
                  <col className="w-36" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="pb-2 text-left text-[11px] font-medium text-muted-foreground">
                      Segment
                    </th>
                    <Head worries={order} />
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g}>
                    <tr>
                      <th colSpan={order.length + 1} scope="colgroup" className="pt-2 pb-1 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {g}
                      </th>
                    </tr>
                    {bySegment
                      .filter((r) => r.group === g)
                      .map((r) => (
                        <tr key={r.name}>
                          <th scope="row" className="pr-2 text-left font-normal">
                            <span className="text-sm">{r.name}</span> <span className="text-muted-foreground tabular-nums">{num(r.n)}</span>
                          </th>
                          {order.map((w) => (
                            <td
                              key={w}
                              className={cn("h-8 rounded-sm text-center tabular-nums", w === r.top ? "font-semibold text-foreground" : "text-muted-foreground")}
                              style={{ background: heat(r.cells[w], segMax) }}
                            >
                              {r.cells[w] ? pct(r.cells[w]) : "–"}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                ))}
              </table>
            </div>
          </Panel>

          <Panel title="Worries by township" note="Like rate of buyers whose biggest worry it is · red below, green above the township's average">
            {!byTownship.length ? (
              <Empty />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] table-fixed border-separate border-spacing-0.5 text-xs">
                  <caption className="sr-only">Like rate per township among buyers with each biggest worry, against the township average</caption>
                  <colgroup>
                    <col className="w-44" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col" className="pb-2 text-left text-[11px] font-medium text-muted-foreground">
                        Township · avg like rate
                      </th>
                      <Head worries={townCols} />
                    </tr>
                  </thead>
                  <tbody>
                    {byTownship.map((t) => (
                      <tr key={t.id}>
                        <th scope="row" className="pr-2 text-left font-normal">
                          <span className="text-sm">{t.name}</span> <span className="text-muted-foreground tabular-nums">{pct(t.likeRate)}</span>
                        </th>
                        {townCols.map((w) => {
                          const c = t.cells[w];
                          return (
                            <td
                              key={w}
                              className={cn("h-8 rounded-sm text-center tabular-nums", c ? "text-foreground" : "text-muted-foreground/60")}
                              style={c ? { background: lift(c.lift) } : undefined}
                              title={c ? `${painPointShort[w]}: ${pct(c.likeRate)} like rate on ${num(c.shown)} swipes (${c.lift.toFixed(2)}× the township)` : "Too few swipes to judge"}
                            >
                              {c ? pct(c.likeRate) : "·"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {townFlag ? (
              <p className="mt-3 text-sm text-muted-foreground">
                <strong className="font-medium text-foreground">{townFlag.town}</strong> loses buyers worried about {painPointShort[townFlag.worry].toLowerCase()}: {pct(townFlag.likeRate)} like it against{" "}
                {pct(townFlag.avg)} overall. {worryAction[townFlag.worry]}.
              </p>
            ) : null}
          </Panel>

          <Panel title="What to say to each worry" note="One marketing or sales move per worry, most common first">
            <ol className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              {overall.map((r) => (
                <li key={r.worry} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 border-b py-2.5 text-sm">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {pct(r.topShare)} biggest · {pct(r.share)} mention
                  </span>
                  <p className="col-span-2 text-muted-foreground">{r.action}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      )}
    </Section>
  );
}
