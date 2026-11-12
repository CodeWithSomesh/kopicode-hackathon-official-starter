import type { Metadata } from "next";
import Link from "next/link";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { passReasons } from "@/lib/homelander/data";
import { demandSummary, WINDOW } from "@/lib/homelander/demand";
import { cn } from "@/lib/utils";
import { LeadInbox } from "./lead-inbox";

export const metadata: Metadata = { title: "HomeLander demand" };

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function HomeLanderDemandPage() {
  const d = demandSummary();
  const maxRate = Math.max(...d.byTownship.map((t) => t.rate));

  return (
    <div className="grid gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-3xl gap-2">
          <h1 className="font-pixel text-3xl leading-none font-bold">
            HomeLander demand
          </h1>
          <p className="text-lg leading-snug">
            {d.finding.township} loses {pct(d.finding.share)} of its explained
            passes to &ldquo;
            {d.finding.reason.toLowerCase()}&rdquo;.
          </p>
          <p className="text-sm text-ink-soft">
            {WINDOW.label} · {d.buyers.toLocaleString("en-MY")} buyers · sample
            data
          </p>
        </div>
        <div className="flex items-center gap-4">
          <PixButton asChild tone="kaya" size="sm">
            <Link href="/swipe">
              <Sprite art="heart" scale={2} className="text-raya" />
              Open the buyer app
            </Link>
          </PixButton>
        </div>
      </div>

      <PixPanel asChild>
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Swipes",
              value: d.total.toLocaleString("en-MY"),
              note: `${(d.total / d.buyers).toFixed(1)} per buyer`,
            },
            {
              label: "Right-swipe rate",
              value: pct(d.rate),
              note: `${d.likes.toLocaleString("en-MY")} yes of ${d.total.toLocaleString("en-MY")}`,
            },
            {
              label: "Buyers",
              value: d.buyers.toLocaleString("en-MY"),
              note: "Unique sessions",
            },
            {
              label: "Townships",
              value: d.byTownship.length.toString(),
              note: "Live in the deck",
            },
          ].map((k, i) => (
            <div
              key={k.label}
              className={cn(
                "grid gap-1 p-5",
                i > 0 && "border-l-3 border-ink",
                i === 2 && "max-lg:border-t-3 max-lg:border-l-0",
                i === 3 && "max-lg:border-t-3",
              )}
            >
              <dt className="text-sm text-ink-soft">{k.label}</dt>
              <dd className="font-pixel text-3xl leading-none tabular-nums">
                {k.value}
              </dd>
              <dd className="text-xs text-ink-soft tabular-nums">{k.note}</dd>
            </div>
          ))}
        </dl>
      </PixPanel>

      <LeadInbox />

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <PixPanel asChild>
          <section
            aria-labelledby="want-title"
            className="grid content-start gap-4 p-5"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="want-title" className="font-pixel text-xl font-bold">
                Which townships buyers want
              </h2>
              <p className="text-xs text-ink-soft">Right-swipe rate</p>
            </div>
            <ul className="grid gap-3">
              {d.byTownship.map((t) => {
                const top = t.rate === maxRate;
                return (
                  <li
                    key={t.township.id}
                    className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm"
                  >
                    <span className="truncate">{t.township.name}</span>
                    <span className="h-4 border-2 border-ink bg-cloud">
                      <span
                        className={cn(
                          "block h-full",
                          top ? "bg-pandan" : "bg-sky-deep",
                        )}
                        style={{ width: `${(t.rate / maxRate) * 100}%` }}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-right font-pixel tabular-nums",
                        top && "font-bold",
                      )}
                    >
                      {pct(t.rate)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-ink-soft">
              Bars are scaled to the top township.{" "}
              {d.byTownship[0]!.township.name}:{" "}
              {d.byTownship[0]!.likes.toLocaleString("en-MY")} yes of{" "}
              {d.byTownship[0]!.swipes.toLocaleString("en-MY")} swipes.
            </p>
          </section>
        </PixPanel>

        <PixPanel asChild>
          <section
            aria-labelledby="seg-title"
            className="grid content-start gap-4 p-5"
          >
            <h2 id="seg-title" className="font-pixel text-xl font-bold">
              Who wants what
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft">
                  <th className="py-2 pr-3 font-normal">Buyer age</th>
                  <th className="py-2 pr-3 text-right font-normal">Buyers</th>
                  <th className="py-2 pr-3 text-right font-normal">Landed</th>
                  <th className="py-2 text-right font-normal">High-rise</th>
                </tr>
              </thead>
              <tbody>
                {d.bySegment.map((s) => (
                  <tr key={s.segment} className="border-t-2 border-ink/15">
                    <td className="py-2.5 pr-3">{s.segment}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {s.buyers}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 pr-3 text-right tabular-nums",
                        s.landedRate > s.highRate && "bg-kaya/60 font-semibold",
                      )}
                    >
                      {pct(s.landedRate)}
                    </td>
                    <td
                      className={cn(
                        "py-2.5 pr-1 text-right tabular-nums",
                        s.highRate > s.landedRate && "bg-kaya/60 font-semibold",
                      )}
                    >
                      {pct(s.highRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-ink-soft">
              Right-swipe rate by home type. Highlighted is what each age group
              prefers.
            </p>
          </section>
        </PixPanel>
      </div>

      <PixPanel asChild>
        <section aria-labelledby="pass-title" className="grid gap-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="pass-title" className="font-pixel text-xl font-bold">
              Why buyers pass
            </h2>
            <p className="text-xs text-ink-soft">
              Share of passes where the buyer gave a reason
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft">
                  <th className="py-2 pr-3 font-normal">Township</th>
                  <th className="py-2 pr-3 text-right font-normal">Passes</th>
                  {passReasons.map((r) => (
                    <th key={r} className="py-2 pr-3 text-right font-normal">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.byTownship.map((t) => {
                  const top = Math.max(...t.reasons);
                  return (
                    <tr
                      key={t.township.id}
                      className="border-t-2 border-ink/15"
                    >
                      <td className="py-2.5 pr-3">{t.township.name}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {t.passes.toLocaleString("en-MY")}
                      </td>
                      {t.reasons.map((n, i) => (
                        <td
                          key={passReasons[i]}
                          className={cn(
                            "py-2.5 pr-3 text-right tabular-nums",
                            n === top
                              ? "bg-raya/15 font-semibold text-raya-deep"
                              : "text-ink-soft",
                          )}
                        >
                          {pct(t.withReason ? n / t.withReason : 0)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            What to do with it: far-out townships need the rail and feeder-bus
            story up front; city towers lose on size, so lead with layouts.
          </p>
        </section>
      </PixPanel>
    </div>
  );
}
