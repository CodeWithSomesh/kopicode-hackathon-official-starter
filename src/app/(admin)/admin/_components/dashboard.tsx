"use client";

import { useMemo, useState } from "react";
import { DatabaseIcon, DownloadIcon } from "lucide-react";
import { liveSessions } from "@/lib/homelander/admin-live";
import {
  bankInsights,
  funnel,
  kpis,
  leads,
  locations,
  priceGap,
  products,
  segments,
  slice,
  townshipDemand,
  trend,
  worries,
  type Filters,
  type RangeDays,
} from "@/lib/homelander/admin-metrics";
import { buyerTypes, regions, sampleSessions, SAMPLE_END_MS, DAY_MS, type BuyerType } from "@/lib/homelander/demand";
import { useT } from "@/lib/homelander/i18n/client";
import { useHomeLander } from "@/lib/homelander/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { Bank } from "./bank";
import { DemandSupply } from "./demand";
import { Funnel } from "./funnel";
import { downloadLeadsCsv, Leads, useLeadStatus } from "./leads";
import { LiveBadge } from "./kit";
import { Location } from "./location";
import { KpiRow, TrendChart } from "./overview";
import { Passes } from "./passes";
import { PriceGap } from "./pricing";
import { Products } from "./products";
import { Segments } from "./segments";
import { Worries } from "./worries";

const ranges: RangeDays[] = [7, 30, 90];
const dateFmt = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
const timeFmt = new Intl.DateTimeFormat("en-MY", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kuala_Lumpur" });

export function Dashboard() {
  const t = useT();
  const [filters, setFilters] = useState<Filters>({ days: 30, region: "all", buyerType: "all", showSample: true });
  const store = useHomeLander();
  // Rendered in the browser only (see dashboard-loader), so reading the clock here is safe.
  const [now] = useState(() => Date.now());
  const [statusOverrides, setStatus] = useLeadStatus();

  const live = useMemo(() => liveSessions(store, now), [store, now]);
  const all = useMemo(() => [...sampleSessions(), ...live], [live]);

  const d = useMemo(() => {
    const sl = slice(all, filters);
    const towns = townshipDemand(sl.cur, filters.region);
    return {
      sl,
      kpis: kpis(sl),
      trend: trend(sl),
      funnel: funnel(sl.cur),
      towns,
      location: locations(sl.cur, filters.region),
      price: priceGap(sl.cur, filters.region),
      segments: segments(sl.cur),
      worries: worries(sl.cur),
      products: products(sl, filters.region),
      bank: bankInsights(sl.cur),
    };
  }, [all, filters]);
  const leadRows = useMemo(() => leads(d.sl.cur, statusOverrides), [d.sl.cur, statusOverrides]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const from = dateFmt.format(new Date(d.sl.start));
  const to = dateFmt.format(new Date(SAMPLE_END_MS - DAY_MS));
  const liveCount = d.sl.cur.filter((s) => s.live).length;

  return (
    <div className="grid grid-cols-1 gap-5">
      {/* Header */}
      <div className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{t("Buyer insights")}</h1>
              {filters.showSample ? (
                <Badge variant="warning" className="gap-1">
                  <DatabaseIcon aria-hidden />
                  {t("Sample data")}
                </Badge>
              ) : null}
              {live.length ? <LiveBadge /> : null}
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {t("What HomeLander buyers want, can afford and pass on, so Gamuda Land can decide where to build, how to price and who to call.")}
            </p>
            <p className="text-xs text-muted-foreground">
              {from} – {to} · {t("Updated {time}", { time: timeFmt.format(new Date(now)) })} ·{" "}
              {filters.showSample ? t("{n} sample sessions", { n: d.sl.cur.length - liveCount }) : t("sample hidden")}
              {liveCount ? ` + ${t("{n} live from this browser", { n: liveCount })}` : live.length ? ` · ${t("live sessions hidden by these filters")}` : ` · ${t("no live activity in this browser yet")}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadLeadsCsv(leadRows)} disabled={!leadRows.length}>
            <DownloadIcon aria-hidden />
            {t("Export leads CSV")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-xs" role="group" aria-label={t("Filters")}>
          <div className="inline-flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label={t("Date range")}>
            {ranges.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={filters.days === r}
                onClick={() => set("days", r)}
                className={cn(
                  "h-8 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  filters.days === r && "bg-card text-foreground shadow-xs",
                )}
              >
                {t("{n} days", { n: r })}
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="f-region">
            {t("Region")}
          </label>
          <NativeSelect id="f-region" className="h-9 w-40" value={filters.region} onChange={(e) => set("region", e.target.value as Filters["region"])}>
            <option value="all">{t("All regions")}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </NativeSelect>
          <label className="sr-only" htmlFor="f-type">
            {t("Buyer type")}
          </label>
          <NativeSelect id="f-type" className="h-9 w-40" value={filters.buyerType} onChange={(e) => set("buyerType", e.target.value as BuyerType | "all")}>
            <option value="all">{t("All buyer types")}</option>
            {buyerTypes.map((bt) => (
              <option key={bt} value={bt}>
                {bt}
              </option>
            ))}
          </NativeSelect>
          <button
            type="button"
            role="switch"
            aria-checked={filters.showSample}
            onClick={() => set("showSample", !filters.showSample)}
            className="ml-auto inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className={cn("relative h-5 w-9 rounded-full transition-colors", filters.showSample ? "bg-primary" : "bg-input")}>
              <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow transition-transform", filters.showSample && "translate-x-4")} />
            </span>
            {t("Include sample data")}
          </button>
        </div>
      </div>

      <KpiRow items={d.kpis} days={filters.days} />
      <TrendChart rows={d.trend} days={filters.days} />
      <Funnel data={d.funnel} />
      <DemandSupply data={d.towns} />
      <Location data={d.location} />
      <PriceGap data={d.price} />
      <Segments data={d.segments} />
      <Worries data={d.worries} />
      <Passes data={d.towns} />
      <Products rows={d.products} bucketLabel={filters.days === 90 ? "week" : "day"} />
      <Leads rows={leadRows} now={now} onStatus={setStatus} />
      <Bank data={d.bank} />
    </div>
  );
}
