"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num, pct, type townshipDemand } from "@/lib/homelander/admin-metrics";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { axis, ChartFigure, Empty, legend, Meter, Panel, Section, tooltip } from "./kit";

/** Fewer likes than this is too little data to call a township under- or over-supplied. */
const MIN_LIKES = 10;

function IndexBadge({ index, likes }: { index: number; likes: number }) {
  if (likes < MIN_LIKES) return <Badge variant="outline">Too few likes</Badge>;
  if (index >= 1.5) return <Badge className="border-transparent bg-[color-mix(in_oklch,var(--bad)_14%,transparent)] text-[var(--bad)]">Under-supplied</Badge>;
  if (index <= 0.6) return <Badge variant="secondary">Over-supplied</Badge>;
  return <Badge variant="outline">Balanced</Badge>;
}

export function DemandSupply({ data }: { data: ReturnType<typeof townshipDemand> }) {
  const { rows, hot, totalLikes, totalLeft } = data;
  const chart = rows.map((r) => ({ name: r.name.replace(/ (Residences|Estates|Suites)$/, ""), likes: Math.round((r.likes / (totalLikes || 1)) * 1000) / 10, stock: Math.round((r.unitsLeft / (totalLeft || 1)) * 1000) / 10 }));
  const top = hot[0];
  return (
    <Section
      id="demand"
      title="Demand vs supply by township"
      purpose="Where buyers' likes go compared with the stock we still have to sell. An index above 1 means demand outruns supply."
      audience="land planning and sales"
      takeaway={
        top ? (
          <>
            <strong>{hot.map((h) => h.name).join(", ")}</strong> {hot.length > 1 ? "are" : "is"} under-supplied: {top.name} gets {pct(top.likes / (totalLikes || 1))} of all likes but holds only{" "}
            {pct(top.unitsLeft / (totalLeft || 1))} of the units left (index {top.index.toFixed(1)}). Prioritise the next phase or a price review there.
          </>
        ) : totalLikes ? (
          <>No township is clearly under-supplied in this view: demand roughly follows stock.</>
        ) : undefined
      }
    >
      {!totalLikes ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          <Panel title="Share of likes vs share of units left" note="% of total, sample stock">
            <ChartFigure
              label="Share of likes compared with share of units left, by township"
              columns={["Township", "Share of likes %", "Share of units left %"]}
              rows={chart.map((c) => [c.name, c.likes, c.stock])}
              className="h-64"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis dataKey="name" {...axis} interval="preserveStartEnd" minTickGap={4} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickMargin={8} height={36} />
                  <YAxis {...axis} unit="%" width={48} />
                  <Tooltip {...tooltip} formatter={(v) => `${v}%`} />
                  <Legend {...legend} />
                  <Bar dataKey="likes" name="Share of likes" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="stock" name="Share of units left" fill="var(--chart-5)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFigure>
          </Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Township</TableHead>
                <TableHead className="text-right">Likes</TableHead>
                <TableHead className="text-right">Like rate</TableHead>
                <TableHead className="text-right">Battle wins</TableHead>
                <TableHead>Top pass reason</TableHead>
                <TableHead className="text-right">Avg match</TableHead>
                <TableHead className="text-right">Units left</TableHead>
                <TableHead className="w-40">Demand ÷ supply</TableHead>
                <TableHead>Signal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={cn(r.index >= 1.5 && "bg-[color-mix(in_oklch,var(--bad)_5%,transparent)]")}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.area}
                      {r.status === "completed" ? " · resale" : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.likes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(r.likeRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(r.wins)}
                    <span className="ml-1 text-xs text-muted-foreground">({pct(r.winRate)})</span>
                  </TableCell>
                  <TableCell>{r.topReason ?? "–"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.avgScore.toFixed(0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(r.unitsLeft)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Meter value={Math.min(r.index, 3)} max={3} color={r.index >= 1.5 ? "var(--bad)" : "var(--chart-1)"} className="w-20" />
                      <span className="tabular-nums">{r.index.toFixed(2)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <IndexBadge index={r.index} likes={r.likes} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Demand ÷ supply = township&apos;s share of likes ÷ its share of units left. Units left are SAMPLE stock figures.
          </p>
        </div>
      )}
    </Section>
  );
}
