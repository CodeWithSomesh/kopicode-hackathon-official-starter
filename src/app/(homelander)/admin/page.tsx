import type { Metadata } from "next";
import Link from "next/link";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { passReasons } from "@/lib/homelander/data";
import { demandSummary, WINDOW } from "@/lib/homelander/demand";
import { getT } from "@/lib/homelander/i18n/server";
import { cn } from "@/lib/utils";
import { LeadInbox } from "./lead-inbox";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("HomeLander demand") };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function HomeLanderDemandPage() {
  const t = await getT();
  const d = demandSummary();
  // Data words from demand.ts / data.ts, translated here at render (literals so npm run i18n:check sees them).
  const reason: Record<string, string> = {
    "Too far": t("Too far"),
    "Too pricey": t("Too pricey"),
    "Too small": t("Too small"),
    "Not my style": t("Not my style"),
  };
  const segment: Record<string, string> = {
    "Under 35": t("Under 35"),
    "35 to 49": t("35 to 49"),
    "50 and over": t("50 and over"),
  };
  const maxRate = Math.max(...d.byTownship.map((row) => row.rate));

  return (
    <div className="grid gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid max-w-3xl gap-2">
          <h1 className="font-pixel text-3xl leading-none font-bold">
            {t("HomeLander demand")}
          </h1>
          <p className="text-lg leading-snug">
            {t("{township} loses {share} of its explained passes to “{reason}”.", {
              township: d.finding.township,
              share: pct(d.finding.share),
              reason: reason[d.finding.reason].toLowerCase(),
            })}
          </p>
          <p className="text-sm text-ink-soft">
            {t("{window} · {buyers} buyers · sample data", {
              window: WINDOW.label,
              buyers: d.buyers.toLocaleString("en-MY"),
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <PixButton asChild tone="kaya" size="sm">
            <Link href="/swipe">
              <Sprite art="heart" scale={2} className="text-raya" />
              {t("Open the buyer app")}
            </Link>
          </PixButton>
        </div>
      </div>

      <PixPanel asChild>
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: t("Swipes"),
              value: d.total.toLocaleString("en-MY"),
              note: t("{n} per buyer", { n: (d.total / d.buyers).toFixed(1) }),
            },
            {
              label: t("Right-swipe rate"),
              value: pct(d.rate),
              note: t("{yes} yes of {total}", { yes: d.likes.toLocaleString("en-MY"), total: d.total.toLocaleString("en-MY") }),
            },
            {
              label: t("Buyers"),
              value: d.buyers.toLocaleString("en-MY"),
              note: t("Unique sessions"),
            },
            {
              label: t("Townships"),
              value: d.byTownship.length.toString(),
              note: t("Live in the deck"),
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
                {t("Which townships buyers want")}
              </h2>
              <p className="text-xs text-ink-soft">{t("Right-swipe rate")}</p>
            </div>
            <ul className="grid gap-3">
              {d.byTownship.map((row) => {
                const top = row.rate === maxRate;
                return (
                  <li
                    key={row.township.id}
                    className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm"
                  >
                    <span className="truncate">{row.township.name}</span>
                    <span className="h-4 border-2 border-ink bg-cloud">
                      <span
                        className={cn(
                          "block h-full",
                          top ? "bg-pandan" : "bg-sky-deep",
                        )}
                        style={{ width: `${(row.rate / maxRate) * 100}%` }}
                      />
                    </span>
                    <span
                      className={cn(
                        "text-right font-pixel tabular-nums",
                        top && "font-bold",
                      )}
                    >
                      {pct(row.rate)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-ink-soft">
              {t("Bars are scaled to the top township.")}{" "}
              {t("{township}: {yes} yes of {swipes} swipes.", {
                township: d.byTownship[0]!.township.name,
                yes: d.byTownship[0]!.likes.toLocaleString("en-MY"),
                swipes: d.byTownship[0]!.swipes.toLocaleString("en-MY"),
              })}
            </p>
          </section>
        </PixPanel>

        <PixPanel asChild>
          <section
            aria-labelledby="seg-title"
            className="grid content-start gap-4 p-5"
          >
            <h2 id="seg-title" className="font-pixel text-xl font-bold">
              {t("Who wants what")}
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft">
                  <th className="py-2 pr-3 font-normal">{t("Buyer age")}</th>
                  <th className="py-2 pr-3 text-right font-normal">{t("Buyers")}</th>
                  <th className="py-2 pr-3 text-right font-normal">{t("Landed")}</th>
                  <th className="py-2 text-right font-normal">{t("High-rise")}</th>
                </tr>
              </thead>
              <tbody>
                {d.bySegment.map((s) => (
                  <tr key={s.segment} className="border-t-2 border-ink/15">
                    <td className="py-2.5 pr-3">{segment[s.segment]}</td>
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
              {t("Right-swipe rate by home type. Highlighted is what each age group prefers.")}
            </p>
          </section>
        </PixPanel>
      </div>

      <PixPanel asChild>
        <section aria-labelledby="pass-title" className="grid gap-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="pass-title" className="font-pixel text-xl font-bold">
              {t("Why buyers pass")}
            </h2>
            <p className="text-xs text-ink-soft">
              {t("Share of passes where the buyer gave a reason")}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-soft">
                  <th className="py-2 pr-3 font-normal">{t("Township")}</th>
                  <th className="py-2 pr-3 text-right font-normal">{t("Passes")}</th>
                  {passReasons.map((r) => (
                    <th key={r} className="py-2 pr-3 text-right font-normal">
                      {reason[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.byTownship.map((row) => {
                  const top = Math.max(...row.reasons);
                  return (
                    <tr
                      key={row.township.id}
                      className="border-t-2 border-ink/15"
                    >
                      <td className="py-2.5 pr-3">{row.township.name}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {row.passes.toLocaleString("en-MY")}
                      </td>
                      {row.reasons.map((n, i) => (
                        <td
                          key={passReasons[i]}
                          className={cn(
                            "py-2.5 pr-3 text-right tabular-nums",
                            n === top
                              ? "bg-raya/15 font-semibold text-raya-deep"
                              : "text-ink-soft",
                          )}
                        >
                          {pct(row.withReason ? n / row.withReason : 0)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            {t("What to do with it: far-out townships need the rail and feeder-bus story up front; city towers lose on size, so lead with layouts.")}
          </p>
        </section>
      </PixPanel>
    </div>
  );
}
