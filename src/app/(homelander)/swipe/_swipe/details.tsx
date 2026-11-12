"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PixTag } from "@/components/homelander/pixel";
import { Sprite, type SpriteArt, type SpriteName } from "@/components/homelander/sprite";
import { availabilityOf, rm, samplePayslip, townshipById, type Unit } from "@/lib/homelander/data";
import { useT } from "@/lib/homelander/i18n/client";
import type { Pick as Match } from "@/lib/homelander/recommend";
import { cn } from "@/lib/utils";
import type { HomeDetails, MoneyBasis } from "./buyer";
import { StockBar } from "./stock";
import { swipeSprites } from "./sprites";

const n = (v: number) => v.toLocaleString("en-MY");

/**
 * The back of the card: every number that matters, worked out for this buyer.
 * Money, commute, family, the home itself, then Uncle's full take.
 */
export function CardDetails({
  unit,
  pick,
  d,
  basis,
  onClose,
}: {
  unit: Unit;
  pick?: Match;
  d: HomeDetails;
  basis: MoneyBasis;
  onClose: () => void;
}) {
  const t = townshipById[unit.townshipId]!;
  const tr = useT();
  const { money, commute, family, completion } = d;
  const a = availabilityOf(unit.id);
  const c = commute.cost;
  const modeCost = commute.mode === "train" ? c.train.totalRM : c.car.totalRM;

  return (
    <div className="grid content-start">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-2 border-ink/10 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="truncate font-pixel text-lg leading-tight">{t.name}</p>
          <p className="truncate text-xs text-ink-soft">
            {unit.product ? `${unit.product}, ` : ""}
            {unit.name}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-semibold hover:bg-cloud"
          aria-label={tr("Back to the photo (Escape)")}
        >
          <Sprite art={swipeSprites.down} scale={2} />
          Photo
        </button>
      </div>

      <div className="grid gap-5 px-4 pt-4 pb-6">
        {/* Money */}
        <Section art={swipeSprites.coin} title={tr("Money")} tone="text-kaya-deep">
          <div className="grid grid-cols-2 gap-2.5">
            <Big label={tr("Monthly instalment")} value={rm(money.instalmentRM)} hint={tr("{n} yrs at {rate}%", { n: basis.tenureYears, rate: (basis.rate * 100).toFixed(1) })} />
            <Big label={tr("Cash upfront")} value={rm(money.upfrontRM)} hint={tr("Deposit, duty, legal")} />
          </div>
          <Rows>
            <Row label="Down payment (10%)" value={rm(money.downPaymentRM)} />
            <Row label="Stamp duty, transfer" value={rm(money.stampDutyRM)} />
            <Row label="Stamp duty, loan" value={rm(money.loanStampRM)} />
            <Row label="Legal fees" value={rm(money.legalRM)} />
            {money.savingsGapRM !== null ? (
              <Row
                label={tr("Against your savings")}
                value={money.savingsGapRM > 0 ? tr("{amount} short", { amount: rm(money.savingsGapRM) }) : tr("{amount} spare", { amount: rm(-money.savingsGapRM) })}
                tone={money.savingsGapRM > 0 ? "bad" : "good"}
              />
            ) : null}
          </Rows>
          <Rows>
            <Row label="Instalment" value={rm(money.instalmentRM)} />
            <Row
              label={
                unit.maintenancePsfRM !== undefined
                  ? tr("RM{amount} psf maintenance", { amount: unit.maintenancePsfRM.toFixed(2) })
                  : unit.serviceRM !== undefined
                    ? tr("Guard and service fee")
                    : tr("Maintenance")
              }
              value={money.upkeepRM !== null ? rm(money.upkeepRM) : tr("Not published")}
              muted={money.upkeepRM === null}
            />
            <Row
              label={
                commute.far
                  ? tr("Commute")
                  : commute.mode === "train"
                    ? commute.modeAssumed
                      ? tr("Commute by train (cheaper)")
                      : tr("Commute by train")
                    : commute.modeAssumed
                      ? tr("Commute by car (cheaper)")
                      : tr("Commute by car")
              }
              value={commute.far ? tr("Not counted") : rm(money.commuteRM)}
              muted={commute.far}
            />
            <Row label={tr("Every month, all in")} value={rm(money.totalMonthlyRM)} strong />
            <Row
              label={tr("Left after bills and loans")}
              value={rm(money.leftRM)}
              tone={money.leftRM < 0 ? "bad" : money.leftRM < 1500 ? "warn" : "good"}
              strong
            />
          </Rows>
          <Note>
            {basis.source === "uncle"
              ? basis.estimated
                ? tr("From what you told Uncle: {amount} take-home (estimated), {n}-year loan.", { amount: rm(basis.netRM), n: basis.tenureYears })
                : tr("From what you told Uncle: {amount} take-home, {n}-year loan.", { amount: rm(basis.netRM), n: basis.tenureYears })
              : basis.source === "bank"
                ? tr("From your bank check: {amount} take-home.", { amount: rm(basis.netRM) })
                : tr("Sample payslip ({amount} gross). Sit with Uncle for your own numbers.", { amount: rm(samplePayslip.grossRM) })}{" "}
            {rm(money.psfRM)} per sq ft. {unit.source === "official" ? tr("Price from gamudaland.com.my.") : tr("Sample price.")}
          </Note>
          {basis.source === "sample" ? (
            <Link href="/onboarding" className="text-sm font-semibold text-pandan-deep underline underline-offset-4">
              {tr("Tell Uncle your salary for real numbers")}
            </Link>
          ) : null}
        </Section>

        {/* Commute */}
        <Section art={swipeSprites.car} title={tr("To {name}", { name: commute.anchor.name })} tone="text-sky-deep">
          {commute.far ? (
            <div className="flex gap-2.5 rounded-xl bg-raya/10 p-3 text-sm">
              <Sprite art={swipeSprites.warn} scale={2} className="mt-0.5 shrink-0 text-raya-deep" />
              <p>
                <span className="font-semibold">{tr("Far from your workplace.")}</span>{" "}
                {tr("{town} is in {place}, about {km} km from {anchor} as the crow flies. Think relocation or remote work, not a daily drive.", {
                  town: t.name,
                  place: t.state ?? t.area,
                  km: Math.round(commute.straightKm),
                  anchor: commute.anchor.name,
                })}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                <Big label={tr("Peak drive")} value={`${c.driveMinPeak} min`} hint={`${c.driveKmOneWay} km`} />
                <Big label={tr("Off-peak")} value={`${c.driveMinOffPeak} min`} hint={tr("One way")} />
                <Big label={tr("By train")} value={`${c.trainMinOneWay} min`} hint={c.station} />
              </div>
              <Rows>
                <Row label={tr("Nearest station")} value={`${c.station}, ${c.stationKm.toFixed(1)} km`} />
                <Row label="Line" value={c.line} />
                <Row
                  label={tr("Tolls, one way (est.)")}
                  value={c.tolls.oneWayRM > 0 ? rm(c.tolls.oneWayRM) : tr("None on the likely route")}
                  muted={c.tolls.oneWayRM === 0}
                />
                {c.tolls.plazas.length ? (
                  <li className="flex flex-wrap gap-1.5 py-1.5">
                    {c.tolls.plazas.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-cloud px-2 py-0.5 text-xs">
                        <Sprite art={swipeSprites.toll} scale={1.5} className="text-ink-soft" />
                        {p.name} <span className="text-ink-soft">{p.highway}</span>
                      </span>
                    ))}
                  </li>
                ) : null}
                <Row label={tr("Fuel a month")} value={rm(c.car.fuelRM)} />
                <Row label={tr("Tolls a month")} value={rm(c.car.tollRM)} />
                <Row label={tr("Parking a month")} value={rm(c.car.parkingRM)} />
                <Row label={tr("Driving, all in")} value={rm(c.car.totalRM)} strong={commute.mode === "car"} />
                <Row label={tr("Train fares and feeder")} value={rm(c.train.totalRM)} strong={commute.mode === "train"} />
              </Rows>
              <p className="flex items-center gap-2 rounded-xl bg-cloud px-3 py-2 text-sm">
                <Sprite art={swipeSprites.clock} scale={2} className="shrink-0 text-ink" />
                <span>
                  <span className="font-pixel text-base tabular-nums">{commute.mode === "train" ? c.hoursPerYear.train : c.hoursPerYear.car} h</span>{" "}
                  {tr("a year on the road at {days} office days a week ({amount} a month).", { days: commute.officeDays, amount: rm(modeCost) })}
                </span>
              </p>
            </>
          )}
          <Note>{tr("Estimates from distance and rush-hour speeds. Tolls are estimated from a hand-built plaza table.")}</Note>
        </Section>

        {/* Family */}
        <Section art={swipeSprites.family} title={tr("Family")} tone="text-pandan-deep">
          <Rows>
            <Row
              label={tr("Bedrooms")}
              value={family.need !== null ? tr("{beds} for your {need}", { beds: family.beds, need: family.need }) : `${family.beds}`}
              tone={family.need === null ? undefined : family.beds >= family.need ? "good" : "bad"}
            />
            <Row label={tr("Bathrooms")} value={`${unit.baths}`} />
          </Rows>
          {family.schools.length ? (
            <ul className="grid gap-1.5">
              {family.schools.map((s) => (
                <li key={s.type} className="flex items-start gap-2.5 text-sm">
                  <Sprite art={swipeSprites.school} scale={2} className={cn("mt-0.5 shrink-0", s.tooFar ? "text-raya-deep" : "text-ink-soft")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-soft">{tr(s.label)}</span>
                    <span className="block truncate">{s.school.name}</span>
                  </span>
                  <span className={cn("shrink-0 font-semibold tabular-nums", s.tooFar && "text-raya-deep")}>
                    {s.school.km.toFixed(1)} km
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Note>{tr("No schools in our data around {name} yet.", { name: t.name })}</Note>
          )}
          {family.schoolLimitKm !== null && family.schools.some((s) => s.tooFar) ? (
            <Note tone="bad">{tr("Red ones are beyond the {km} km you said is okay.", { km: family.schoolLimitKm })}</Note>
          ) : null}
        </Section>

        {/* Home */}
        <Section art="house" title={tr("The home")} tone="text-teh">
          <Rows>
            <Row label={tr("Type")} value={unit.type} />
            <Row label="Built-up" value={`${n(unit.builtUpSqft)} sq ft`} />
            {unit.landSize ? <Row label={tr("Land")} value={unit.landSize} /> : null}
            <Row label="Tenure" value={unit.tenure} />
            <Row
              label={tr("Completion")}
              value={completion.year <= 2026 ? tr("{year}, ready", { year: completion.year }) : `${completion.year}`}
              tone={completion.cantWait ? "bad" : undefined}
            />
          </Rows>
          {completion.cantWait ? <Note tone="bad">{tr("You said you can't wait for a home under construction.")}</Note> : null}
          {[...(t.facilities ?? []), ...unit.highlights].length ? (
            <ul className="flex flex-wrap gap-1.5">
              {[...new Set([...(t.facilities ?? []), ...unit.highlights])].map((f) => (
                <li key={f} className="inline-flex items-center gap-1.5 rounded-full bg-cloud px-2.5 py-1 text-xs">
                  <Sprite art={swipeSprites.leaf} scale={1.5} className="text-pandan-deep" />
                  {f}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-1.5 rounded-xl border-2 border-ink/15 p-3">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>
                <span className="font-pixel text-lg tabular-nums">{a.left}</span>{" "}
                {tr("of {total} left in {phase}", { total: a.total, phase: a.phase })}
              </span>
              <span className="font-pixel-label text-[10px] text-ink-soft uppercase">{tr("Sample stock")}</span>
            </div>
            <StockBar a={a} />
          </div>
          {t.officialUrl ? (
            <a
              href={t.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-pandan-deep underline underline-offset-4"
            >
              {tr("Official {name} page", { name: t.name })}
              <Sprite art={swipeSprites.ext} scale={1.5} />
            </a>
          ) : null}
        </Section>

        {/* Uncle */}
        {pick ? (
          <Section art="uncle" title={tr("Uncle's take")} tone="text-ink">
            <p className="font-pixel text-base">{pick.score}% match</p>
            {pick.reasons.length ? (
              <ul className="grid gap-1.5">
                {pick.reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-sm">
                    <Sprite art="heart" scale={1.5} className="mt-1 shrink-0 text-pandan" />
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}
            {pick.catches.length ? (
              <ul className="grid gap-1.5">
                {pick.catches.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-raya-deep">
                    <Sprite art="cross" scale={1.5} className="mt-1 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <PixTag tone="pandan" className="justify-self-start">
                {tr("No catches")}
              </PixTag>
            )}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Section({ art, title, tone, children }: { art: SpriteArt | SpriteName; title: string; tone: string; children: ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <h3 className="flex items-center gap-2 font-pixel text-lg leading-none">
        <Sprite art={art} scale={2} className={cn("shrink-0", tone)} />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Big({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-xl bg-cloud px-3 py-2.5">
      <span className="truncate text-xs text-ink-soft">{label}</span>
      <span className="truncate font-pixel text-lg leading-tight tabular-nums sm:text-xl">{value}</span>
      {hint ? <span className="truncate text-[11px] text-ink-soft">{hint}</span> : null}
    </div>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="grid divide-y divide-ink/10 rounded-xl border-2 border-ink/10 px-3">{children}</ul>;
}

const toneClass = { good: "text-pandan-deep", warn: "text-kaya-deep", bad: "text-raya-deep" } as const;

function Row({
  label,
  value,
  tone,
  strong,
  muted,
}: {
  label: string;
  value: string;
  tone?: keyof typeof toneClass;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
      <span className={cn("min-w-0", strong ? "font-semibold" : "text-ink-soft")}>{label}</span>
      <span
        className={cn(
          "shrink-0 text-right tabular-nums",
          strong && "font-pixel text-base",
          muted && "text-ink-soft",
          tone && toneClass[tone],
        )}
      >
        {value}
      </span>
    </li>
  );
}

function Note({ children, tone }: { children: ReactNode; tone?: "bad" }) {
  return <p className={cn("text-xs leading-relaxed", tone === "bad" ? "text-raya-deep" : "text-ink-soft")}>{children}</p>;
}
