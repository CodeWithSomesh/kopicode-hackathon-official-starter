"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { num, pct, type priceGap } from "@/lib/homelander/admin-metrics";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { axis, ChartFigure, Empty, legend, Meter, Section, tooltip } from "./kit";

export function PriceGap({ data }: { data: ReturnType<typeof priceGap> }) {
  const { n, rows, gap, unmatchedAll } = data;
  const chart = rows.map((r) => ({ label: r.label, buyers: Math.round(r.share * 1000) / 10, products: r.products, unmatched: Math.round(r.unmatchedShare * 1000) / 10 }));
  return (
    <Section
      id="pricing"
      title="Price band gap"
      purpose="What qualified buyers can borrow for (bank eligibility) against the prices of homes we sell. Bands with buyers but no product are lost demand."
      audience="pricing, product and management"
      takeaway={
        n && gap.unmatched ? (
          <>
            <strong>{pct(gap.share)}</strong> of qualified buyers can afford <strong>{gap.label}</strong> but {gap.products === 0 ? "no Gamuda product sits" : gap.products === 1 ? "only 1 Gamuda product sits" : `only ${gap.products} Gamuda products sit`} there; {pct(gap.unmatchedShare)} of them have nothing within 30% of their limit. Overall{" "}
            {pct(unmatchedAll)} of qualified buyers have no matching home.
          </>
        ) : undefined
      }
    >
      {!n ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ChartFigure
            label="Qualified buyers by maximum affordable price, Gamuda products per price band, and share of buyers with no matching product"
            columns={["Band", "Buyers %", "Products", "No match %"]}
            rows={chart.map((c) => [c.label, c.buyers, c.products, c.unmatched])}
            className="h-80"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={4} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickMargin={8} tickFormatter={(v: string) => v.replace(/RM/g, "")} />
                <YAxis yAxisId="l" {...axis} unit="%" width={52} />
                <YAxis yAxisId="r" orientation="right" {...axis} allowDecimals={false} width={28} />
                <Tooltip {...tooltip} formatter={(v, name) => (name === "Gamuda products" ? [v, name] : [`${v}%`, name])} />
                <Legend {...legend} />
                <Bar yAxisId="l" dataKey="buyers" name="Qualified buyers" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="r" dataKey="products" name="Gamuda products" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={14} />
                <Line yAxisId="l" type="linear" dataKey="unmatched" name="No matching product" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartFigure>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Max affordable</TableHead>
                <TableHead className="text-right">Buyers</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="w-32">No match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className={cn(r.id === gap.id && "bg-[color-mix(in_oklch,var(--chart-4)_7%,transparent)]")}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(r.buyers)} <span className="text-xs text-muted-foreground">({pct(r.share)})</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums" title={r.productNames.join(", ")}>
                    {r.products}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Meter value={r.unmatchedShare} color="var(--chart-4)" className="w-14" />
                      <span className="tabular-nums">{r.buyers ? pct(r.unmatchedShare) : "–"}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground xl:col-span-2">
            Max affordable price from bank.ts eligibility() (60% DSR, 90% margin, tenure to age 70) on each buyer&apos;s income and commitments. &ldquo;No match&rdquo;: no selling Gamuda
            home in the buyer&apos;s region priced between 70% and 100% of their limit.
          </p>
        </div>
      )}
    </Section>
  );
}
