"use client";

import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { num, pct, rmCompact, rmFull, type ProductRow } from "@/lib/homelander/admin-metrics";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, Section, Sparkline } from "./kit";

type Key = "name" | "priceRM" | "shown" | "likeRate" | "winRate" | "eligibleShare" | "monthlyRM" | "unitsLeft";

const cols: { key: Key; label: string; right?: boolean }[] = [
  { key: "name", label: "Product" },
  { key: "priceRM", label: "From", right: true },
  { key: "shown", label: "Impressions", right: true },
  { key: "likeRate", label: "Like rate", right: true },
  { key: "winRate", label: "Battle win", right: true },
  { key: "eligibleShare", label: "Bank-eligible", right: true },
  { key: "monthlyRM", label: "Avg monthly", right: true },
  { key: "unitsLeft", label: "Units left", right: true },
];

export function Products({ rows, bucketLabel }: { rows: ProductRow[]; bucketLabel: string }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "shown", dir: -1 });
  const sorted = [...rows].sort((a, b) => {
    const x = a[sort.key];
    const y = b[sort.key];
    return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir;
  });
  const shown = rows.filter((r) => r.shown >= 100);
  const best = [...shown].sort((a, b) => b.likeRate - a.likeRate)[0];
  const weakFit = [...shown].sort((a, b) => a.eligibleShare - b.eligibleShare)[0];
  return (
    <Section
      id="products"
      title="Product performance"
      purpose="Every product line we sell: how often it is shown, liked, wins Battle and is affordable to the buyers who like it. Click a column to sort."
      audience="sales, product and pricing"
      takeaway={
        best && weakFit ? (
          <>
            <strong>{best.name}</strong> is the most liked product ({pct(best.likeRate)} like rate). <strong>{weakFit.name}</strong> is liked but only {pct(weakFit.eligibleShare)} of
            the buyers who like it can borrow enough: a candidate for a smaller layout or a financing offer.
          </>
        ) : undefined
      }
    >
      {!rows.some((r) => r.shown) ? (
        <Empty />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead key={c.key} className={c.right ? "text-right" : undefined} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 uppercase hover:text-foreground focus-visible:underline focus-visible:outline-none"
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((-s.dir) as 1 | -1) : c.key === "name" ? 1 : -1 }))}
                  >
                    {c.label}
                    {sort.key === c.key ? sort.dir === 1 ? <ArrowUpIcon className="size-3" aria-hidden /> : <ArrowDownIcon className="size-3" aria-hidden /> : null}
                  </button>
                </TableHead>
              ))}
              <TableHead className="w-28">Likes trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {r.township} · {r.type}
                    {r.status === "completed" ? <Badge variant="secondary">Resale</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums" title={rmFull(r.priceRM)}>
                  {rmCompact(r.priceRM)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{num(r.shown)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.shown ? pct(r.likeRate) : "–"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.battles ? pct(r.winRate) : "–"}
                  {r.battles ? <span className="ml-1 text-xs text-muted-foreground">of {r.battles}</span> : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.likes ? pct(r.eligibleShare) : "–"}</TableCell>
                <TableCell className="text-right tabular-nums">{rmFull(r.monthlyRM)}</TableCell>
                <TableCell className="text-right tabular-nums">{num(r.unitsLeft)}</TableCell>
                <TableCell>
                  <Sparkline data={r.series} className="w-24" label={`Likes per ${bucketLabel} for ${r.name}: ${r.series.join(", ")}`} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Avg monthly: instalment on a 90% loan at 4.2% over each liking buyer&apos;s maximum tenure. Bank-eligible: share of buyers who liked it whose limit covers the price. Units left are
        SAMPLE stock.
      </p>
    </Section>
  );
}
