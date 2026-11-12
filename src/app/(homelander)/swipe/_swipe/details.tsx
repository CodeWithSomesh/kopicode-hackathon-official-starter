"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PixTag } from "@/components/homelander/pixel";
import { Sprite, type SpriteArt, type SpriteName } from "@/components/homelander/sprite";
import { availabilityOf, rm, townshipById, type Unit } from "@/lib/homelander/data";
import type { Pick as Match } from "@/lib/homelander/recommend";
import { cn } from "@/lib/utils";
import type { HomeDetails, MoneyBasis } from "./buyer";
import { StockBar } from "./stock";
import { swipeSprites } from "./sprites";

const n = (v: number) => v.toLocaleString("en-MY");

/**
 * The back of the card: every number that matters, worked out for this buyer.
 * Their worries first, then money, commute, family, the home itself, then Mochi's full take.
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
  /** Null when the buyer hasn't given a salary or run the bank check. */
  basis: MoneyBasis | null;
  onClose: () => void;
}) {
  const t = townshipById[unit.townshipId]!;
  const { money, commute, family, completion, worries } = d;
  const a = availabilityOf(unit.id);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] content-start">
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
          aria-label="Back to the photo (Escape)"
        >
          <Sprite art={swipeSprites.down} scale={2} />
          Photo
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 px-4 pt-4 pb-6">
        {/* Worries */}
        {worries.length ? (
          <Section art="heart" title="Your worries" tone="text-raya-deep">
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {worries.map((w, i) => (
                <li key={w.worry} className="flex items-start gap-2.5 rounded-xl bg-cloud px-3 py-2.5 text-sm">
                  <Sprite
                    art={w.tone === "good" ? "heart" : w.tone === "bad" ? "cross" : "sparkle"}
                    scale={1.5}
                    className={cn("mt-1 shrink-0", worryToneClass[w.tone])}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-soft">
                      {w.label}
                      {i === 0 ? " · your biggest worry" : ""}
                    </span>
                    <span className="block">{w.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {/* Money */}
        <Section art={swipeSprites.coin} title="Money" tone="text-kaya-deep">
          <div className="grid grid-cols-2 gap-2.5">
            {money.instalmentRM !== null && basis ? (
              <Big label="Monthly instalment" value={rm(money.instalmentRM)} hint={`${basis.tenureYears} yrs at ${(basis.rate * 100).toFixed(1)}%`} />
            ) : (
              <Big label="Monthly instalment" value="Ask Mochi" hint="Needs your salary" muted />
            )}
            <Big label="Cash upfront" value={rm(money.upfrontRM)} hint="Deposit, duty, legal" />
          </div>
          <Rows>
            <Row label="Down payment (10%)" value={rm(money.downPaymentRM)} />
            <Row label="Stamp duty, transfer" value={rm(money.stampDutyRM)} />
            <Row label="Stamp duty, loan" value={rm(money.loanStampRM)} />
            <Row label="Legal fees" value={rm(money.legalRM)} />
            {money.savingsGapRM !== null ? (
              <Row
                label="Against your savings"
                value={money.savingsGapRM > 0 ? `${rm(money.savingsGapRM)} short` : `${rm(-money.savingsGapRM)} spare`}
                tone={money.savingsGapRM > 0 ? "bad" : "good"}
              />
            ) : null}
          </Rows>
          <Rows>
            {money.instalmentRM !== null ? <Row label="Instalment" value={rm(money.instalmentRM)} /> : null}
            <Row
              label={money.upkeepHow ?? "Maintenance"}
              value={money.upkeepRM !== null ? rm(money.upkeepRM) : "Not published"}
              muted={money.upkeepRM === null}
            />
            {commute ? (
              <Row
                label={commute.far ? "Commute" : `Commute by ${commute.mode}${commute.modeAssumed ? " (cheaper)" : ""}`}
                value={commute.far || money.commuteRM === null ? "Not counted" : rm(money.commuteRM)}
                muted={commute.far}
              />
            ) : (
              <Row label="Commute" value="Tell Mochi where you work" muted />
            )}
            {money.totalMonthlyRM !== null ? <Row label="Every month, all in" value={rm(money.totalMonthlyRM)} strong /> : null}
            {money.leftRM !== null ? (
              <Row
                label="Left after bills and loans"
                value={rm(money.leftRM)}
                tone={money.leftRM < 0 ? "bad" : money.leftRM < 1500 ? "warn" : "good"}
                strong
              />
            ) : null}
          </Rows>
          <Note>
            {basis ? `${basis.note} ` : ""}
            {rm(money.psfRM)} per sq ft. {unit.source === "official" ? "Price from gamudaland.com.my." : "Sample price."}
          </Note>
          {basis ? null : (
            <Link href="/onboarding" className="justify-self-start text-sm font-semibold text-pandan-deep underline underline-offset-4">
              Tell Mochi your salary for your monthly numbers
            </Link>
          )}
        </Section>

        {/* Commute */}
        {commute ? (
          <CommuteSection commute={commute} townName={t.name} townState={t.state ?? t.area} />
        ) : (
          <Section art={swipeSprites.car} title="Your commute" tone="text-sky-deep">
            <div className="flex gap-2.5 rounded-xl bg-cloud p-3 text-sm">
              <Sprite art={swipeSprites.clock} scale={2} className="mt-0.5 shrink-0 text-ink" />
              <p>
                <span className="font-semibold">Tell Mochi where you work.</span> Drive and train times, tolls and the monthly
                cost of getting to work are worked out from your workplace, so we don&apos;t guess one.
              </p>
            </div>
            <Link href="/onboarding" className="justify-self-start text-sm font-semibold text-pandan-deep underline underline-offset-4">
              Tell Mochi where you work
            </Link>
          </Section>
        )}

        {/* Family */}
        <Section art={swipeSprites.family} title="Family" tone="text-pandan-deep">
          <Rows>
            <Row
              label="Bedrooms"
              value={family.need !== null ? `${family.beds} for your ${family.need}` : `${family.beds}`}
              tone={family.need === null ? undefined : family.beds >= family.need ? "good" : "bad"}
            />
            <Row label="Bathrooms" value={`${unit.baths}`} />
          </Rows>
          {family.schools.length ? (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
              {family.schools.map((s) => (
                <li key={s.type} className="flex items-start gap-2.5 text-sm">
                  <Sprite art={swipeSprites.school} scale={2} className="mt-0.5 shrink-0 text-ink-soft" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-ink-soft">{s.label}</span>
                    <span className="block truncate">{s.school.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {s.school.km.toFixed(1)} km
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Note>No schools in our data around {t.name} yet.</Note>
          )}
        </Section>

        {/* Home */}
        <Section art="house" title="The home" tone="text-teh">
          <Rows>
            <Row label="Type" value={unit.type} />
            <Row label="Built-up" value={`${n(unit.builtUpSqft)} sq ft`} />
            {unit.landSize ? <Row label="Land" value={unit.landSize} /> : null}
            <Row label="Tenure" value={unit.tenure} />
            <Row
              label="Completion"
              value={completion.year <= 2026 ? `${completion.year}, ready` : `${completion.year}`}
              tone={completion.cantWait ? "bad" : undefined}
            />
          </Rows>
          {completion.cantWait ? <Note tone="bad">You said you can&apos;t wait for a home under construction.</Note> : null}
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
                <span className="font-pixel text-lg tabular-nums">{a.left}</span> of {a.total} left in {a.phase}
              </span>
              <span className="font-pixel-label text-[10px] text-ink-soft uppercase">Sample stock</span>
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
              Official {t.name} page
              <Sprite art={swipeSprites.ext} scale={1.5} />
            </a>
          ) : null}
        </Section>

        {/* Mochi */}
        {pick ? (
          <Section art="mochi" title="Mochi's take" tone="text-ink">
            <p className="font-pixel text-base">{pick.score}% match</p>
            {pick.reasons.length ? (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                {pick.reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-sm">
                    <Sprite art="heart" scale={1.5} className="mt-1 shrink-0 text-pandan" />
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}
            {pick.catches.length ? (
              <ul className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                {pick.catches.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-raya-deep">
                    <Sprite art="cross" scale={1.5} className="mt-1 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <PixTag tone="pandan" className="justify-self-start">
                No catches
              </PixTag>
            )}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function CommuteSection({
  commute,
  townName,
  townState,
}: {
  commute: NonNullable<HomeDetails["commute"]>;
  townName: string;
  townState: string;
}) {
  const c = commute.cost;
  const modeCost = commute.mode === "train" ? c.train.totalRM : c.car.totalRM;
  return (
    <Section art={swipeSprites.car} title={`To ${commute.anchor.name}`} tone="text-sky-deep">
      {commute.far ? (
        <div className="flex gap-2.5 rounded-xl bg-raya/10 p-3 text-sm">
          <Sprite art={swipeSprites.warn} scale={2} className="mt-0.5 shrink-0 text-raya-deep" />
          <p>
            <span className="font-semibold">Far from your workplace.</span> {townName} is in {townState}, about{" "}
            {Math.round(commute.straightKm)} km from {commute.anchor.name} as the crow flies. Think relocation or remote work,
            not a daily drive.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            <Big label="Peak drive" value={`${c.driveMinPeak} min`} hint={`${c.driveKmOneWay} km`} />
            <Big label="Off-peak" value={`${c.driveMinOffPeak} min`} hint="One way" />
            <Big label="By train" value={`${c.trainMinOneWay} min`} hint={c.station} />
          </div>
          <Rows>
            <Row label="Nearest station" value={`${c.station}, ${c.stationKm.toFixed(1)} km`} />
            <Row label="Line" value={c.line} />
            <Row
              label="Tolls, one way (est.)"
              value={c.tolls.oneWayRM > 0 ? rm(c.tolls.oneWayRM) : "None on the likely route"}
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
            <Row label="Fuel a month" value={rm(c.car.fuelRM)} />
            <Row label="Tolls a month" value={rm(c.car.tollRM)} />
            <Row label="Parking a month" value={rm(c.car.parkingRM)} />
            <Row label="Driving, all in" value={rm(c.car.totalRM)} strong={commute.mode === "car"} />
            <Row label="Train fares and feeder" value={rm(c.train.totalRM)} strong={commute.mode === "train"} />
          </Rows>
          <p className="flex items-center gap-2 rounded-xl bg-cloud px-3 py-2 text-sm">
            <Sprite art={swipeSprites.clock} scale={2} className="shrink-0 text-ink" />
            <span>
              <span className="font-pixel text-base tabular-nums">{commute.mode === "train" ? c.hoursPerYear.train : c.hoursPerYear.car} h</span> a
              year on the road at {commute.officeDays} office days a week ({rm(modeCost)} a month).
            </span>
          </p>
        </>
      )}
      <Note>Estimates from distance and rush-hour speeds. Tolls are estimated from a hand-built plaza table.</Note>
    </Section>
  );
}

function Section({ art, title, tone, children }: { art: SpriteArt | SpriteName; title: string; tone: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
      <h3 className="flex items-center gap-2 font-pixel text-lg leading-none">
        <Sprite art={art} scale={2} className={cn("shrink-0", tone)} />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Big({ label, value, hint, muted }: { label: string; value: string; hint?: string; muted?: boolean }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-xl bg-cloud px-3 py-2.5">
      <span className="truncate text-xs text-ink-soft">{label}</span>
      <span className={cn("truncate font-pixel text-lg leading-tight tabular-nums sm:text-xl", muted && "text-ink-soft")}>{value}</span>
      {hint ? <span className="truncate text-[11px] text-ink-soft">{hint}</span> : null}
    </div>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-[minmax(0,1fr)] divide-y divide-ink/10 rounded-xl border-2 border-ink/10 px-3">{children}</ul>;
}

const worryToneClass = { good: "text-pandan-deep", warn: "text-kaya-deep", bad: "text-raya-deep", unknown: "text-ink-soft" } as const;

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
          "max-w-[60%] shrink-0 text-right tabular-nums",
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
