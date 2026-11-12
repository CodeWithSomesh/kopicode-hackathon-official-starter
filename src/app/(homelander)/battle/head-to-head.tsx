import type { ReactNode } from "react";
import { PixPanel } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { rm, units } from "@/lib/homelander/data";
import { bestIndices, MEDIAN_PSF, type AnalysisContext, type Fighter } from "@/lib/homelander/analysis";
import { cn } from "@/lib/utils";

type Row = {
  label: string;
  note?: string;
  cell: (f: Fighter) => ReactNode;
  value?: (f: Fighter) => number;
  better?: "high" | "low";
};

const h = (n: number) => `${n.toFixed(1)} h`;

function rows(ctx: AnalysisContext): Row[] {
  return [
    { label: "Price", cell: (f) => rm(f.priceRM), value: (f) => f.priceRM, better: "low" },
    {
      label: "Price per sqft",
      note: `Median of all ${units.length} units: RM${Math.round(MEDIAN_PSF)}`,
      cell: (f) => (
        <>
          RM{Math.round(f.psf)}
          <span className="block text-xs text-ink-soft">
            {f.psfVsMedian >= 0 ? `${Math.round(f.psfVsMedian * 100)}% under median` : `${Math.round(-f.psfVsMedian * 100)}% over median`}
          </span>
        </>
      ),
      value: (f) => f.psf,
      better: "low",
    },
    {
      label: "Monthly instalment",
      note: "90% loan, 4.2%, 35 years",
      cell: (f) => rm(Math.round(f.instalmentRM)),
      value: (f) => f.instalmentRM,
      better: "low",
    },
    {
      label: "Cash upfront",
      note: "10% down, stamp duty, legal fees",
      cell: (f) => rm(f.upfrontRM),
      value: (f) => f.upfrontRM,
      better: "low",
    },
    {
      label: "Left each month",
      note: ctx.money.source === "bank" ? "From your bank check" : "Sample payslip",
      cell: (f) => (
        <>
          <span className={cn(f.leftoverRM < 0 && "text-raya-deep")}>{rm(Math.round(f.leftoverRM))}</span>
          {f.overBudget ? <span className="block text-xs text-raya-deep">Over what the bank may lend</span> : null}
        </>
      ),
      value: (f) => f.leftoverRM,
      better: "high",
    },
    {
      label: "Drive, per week",
      note: `To ${ctx.anchorName}, ${ctx.officeDays} days, both ways`,
      cell: (f) => (
        <>
          {h(f.driveWeekHours)}
          <span className="block text-xs text-ink-soft">{f.driveOneWay} min one way</span>
        </>
      ),
      value: (f) => f.driveWeekHours,
      better: "low",
    },
    {
      label: "Train, per week",
      note: "Rail plus walk or feeder",
      cell: (f) => (
        <>
          {h(f.trainWeekHours)}
          <span className="block text-xs text-ink-soft">
            {f.trainOneWay} min, from {f.station} ({f.stationKm.toFixed(1)} km)
          </span>
        </>
      ),
      value: (f) => f.trainWeekHours,
      better: "low",
    },
    {
      label: "Bedrooms",
      note: `You need ${ctx.bedsNeeded}`,
      cell: (f) => (
        <>
          {f.unit.beds} bed, {f.unit.baths} bath
          {f.bedsShort ? <span className="block text-xs text-raya-deep">{f.bedsShort} short</span> : null}
        </>
      ),
      value: (f) => -f.bedsShort,
      better: "high",
    },
    {
      label: "Built-up",
      cell: (f) => `${f.unit.builtUpSqft.toLocaleString("en-MY")} sqft`,
      value: (f) => f.unit.builtUpSqft,
      better: "high",
    },
    {
      label: "Tenure",
      cell: (f) => f.unit.tenure,
      value: (f) => (f.unit.tenure === "Freehold" ? 1 : 0),
      better: "high",
    },
    {
      label: "Keys in",
      cell: (f) => (f.waitYears === 0 ? `${f.unit.completion}, ready` : `${f.unit.completion}, ${f.waitYears} yr wait`),
      value: (f) => f.waitYears,
      better: "low",
    },
    {
      label: "Units left",
      note: "No star: fewer left means move fast, not better",
      cell: (f) => (
        <>
          {f.availability.left} of {f.availability.total}
          <span className="block text-xs text-ink-soft">
            {f.availability.status}, {f.availability.phase}
          </span>
        </>
      ),
    },
    {
      label: "Township",
      cell: (f) => <span className="text-sm">{f.unit.highlights.join(". ")}.</span>,
    },
    {
      label: "Overall",
      note: "Weighted by your sliders",
      cell: (f) => <span className="font-pixel text-xl">{f.overall}</span>,
      value: (f) => f.overall,
      better: "high",
    },
  ];
}

export function HeadToHead({ fighters, ctx, winnerId }: { fighters: Fighter[]; ctx: AnalysisContext; winnerId: string }) {
  return (
    <section aria-labelledby="h2h-title" className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="h2h-title" className="font-pixel text-2xl leading-none">
          Head to head
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-ink-soft">
          <Sprite art="star" scale={2} className="text-kaya-deep" /> marks the better one in each row
        </p>
      </div>
      <PixPanel className="p-1">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Head-to-head table, scrolls sideways">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm tabular-nums">
            <caption className="sr-only">Every factor for each fighter. A star marks the better cell.</caption>
            <thead>
              <tr className="border-b-[3px] border-ink">
                <th scope="col" className="sticky left-0 z-10 w-44 bg-white px-3 py-3 font-pixel-label text-[11px] uppercase">
                  Factor
                </th>
                {fighters.map((f, i) => (
                  <th
                    key={f.unit.id}
                    scope="col"
                    className={cn("px-3 py-3 align-bottom font-pixel text-base leading-tight", f.unit.id === winnerId && "bg-kaya/40")}
                  >
                    <span className="block text-xs text-ink-soft">P{i + 1}</span>
                    {f.unit.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows(ctx).map((r) => {
                const best = r.value && r.better ? bestIndices(fighters.map(r.value), r.better) : new Set<number>();
                return (
                  <tr key={r.label} className="border-b-2 border-dotted border-ink/20 last:border-0">
                    <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2.5 align-top font-semibold">
                      {r.label}
                      {r.note ? <span className="block text-xs font-normal text-ink-soft">{r.note}</span> : null}
                    </th>
                    {fighters.map((f, i) => (
                      <td
                        key={f.unit.id}
                        className={cn("px-3 py-2.5 align-top", f.unit.id === winnerId && "bg-kaya/15")}
                      >
                        <span className="flex items-start gap-1.5">
                          <span>{r.cell(f)}</span>
                          {best.has(i) ? (
                            <Sprite art="star" scale={2} className="mt-0.5 shrink-0 text-kaya-deep" label="Better" />
                          ) : null}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PixPanel>
    </section>
  );
}
