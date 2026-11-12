import type { ReactNode } from "react";
import type { TFn } from "@/lib/homelander/i18n/translate";
import type { SpriteArt, SpriteName } from "@/components/homelander/sprite";
import { schoolTypeLabel, type SchoolType } from "@/lib/homelander/schools";
import type { BattleContext } from "@/lib/homelander/battle-context";
import type { Fighter } from "@/lib/homelander/battle-verdict";
import type { Fit } from "@/lib/homelander/analysis";
import { painPointLabel } from "@/lib/homelander/profile";
import type { WorryTone } from "@/lib/homelander/worries";
import {
  car,
  chart,
  DsrBar,
  family,
  home,
  kRM,
  money,
  pct,
  signedPct,
  sqft,
  wallet,
} from "./bits";

/**
 * Every row of the head-to-head table, grouped into sections. A row says how to draw a cell,
 * which number decides the best cell, and which way is better. Formulas live in
 * lib/homelander/analysis.ts; this file only presents them.
 */

export type Tone = "bad" | "warn" | "good" | "muted";
export type Cell = { main: ReactNode; sub?: ReactNode; tone?: Tone };

export type Row = {
  id: string;
  label: string;
  /** One line under the label: what the number is, or where it comes from. */
  hint?: string;
  /** Mark rows that use the buyer's own commute mode. */
  mine?: boolean;
  /** Emphasise the row (totals). */
  strong?: boolean;
  /** "est." chip next to the label. */
  estimated?: boolean;
  cell: (f: Fighter) => Cell;
  value?: (f: Fighter) => number | null;
  better?: "high" | "low";
  /** Text for the best cell, given how far it leads the next best. */
  lead?: (gap: number) => string;
};

export type Section = {
  id: string;
  title: string;
  art: SpriteName | SpriteArt;
  blurb?: string;
  rows: Row[];
};

const fitLabel: Record<Fit, string> = {
  in: "In budget",
  stretch: "Stretch",
  over: "Over budget",
  unknown: "Not judged",
};
export const fitTone: Record<Fit, "pandan" | "kaya" | "raya" | "white"> = {
  in: "pandan",
  stretch: "kaya",
  over: "raya",
  unknown: "white",
};

/** The cell for a commute we can't compare: missing input (ask Mochi) or too far to commute. */
const nc = (f: Fighter): Cell =>
  f.you.missing
    ? { main: f.you.missing, sub: "Then this row fills in", tone: "warn" }
    : { main: "Not compared", sub: "Not a daily commute", tone: "muted" };
const NO_INCOME: Cell = {
  main: "Tell Mochi your salary",
  sub: "We don't guess your pay",
  tone: "warn",
};
export function buildSections(
  fighters: Fighter[],
  ctx: BattleContext,
  t: TFn,
): Section[] {
  const perMonthLead = (g: number) => t("{amt}/mo less than next", { amt: money(g) });
  const m = ctx.money;
  const anyPartner = fighters.some((f) => f.partner);
  const youMode = (f: Fighter) => f.you.mode;
  const modeWord =
    ctx.mode === "fastest"
      ? t("faster of car or train")
      : ctx.mode === "car"
        ? t("driving")
        : ctx.mode === "train"
          ? t("train")
          : t("mode not known");
  const days =
    ctx.officeDays === null
      ? t("office days not known")
      : t("{n} office days", { n: ctx.officeDays });

  /* ------------------------------------------------------------ money */
  const moneyRows: Row[] = [
    {
      id: "price",
      label: "Price",
      hint: fighters.some((f) => f.unit.source !== "official")
        ? "Sample or listed price, before rebates"
        : "Listed price, before rebates",
      cell: (f) => ({
        main: money(f.priceRM),
        sub:
          f.unit.source === "official" ? "Gamuda Land listing" : "Sample price",
      }),
      value: (f) => f.priceRM,
      better: "low",
      lead: (g) => t("{amt} under next", { amt: kRM(g) }),
    },
    {
      id: "psf",
      label: "Price per sq ft",
      cell: (f) => ({
        main: `RM${Math.round(f.psf)}`,
        sub: t("{n} sq ft built-up", { n: f.unit.builtUpSqft.toLocaleString("en-MY") }),
      }),
      value: (f) => f.psf,
      better: "low",
    },
    {
      id: "loan",
      label: "Loan",
      hint:
        m.firstHome === true
          ? "90% margin: the usual cap on a first home"
          : "90% margin, usual for a 1st or 2nd home loan; a 3rd is capped at 70%",
      cell: (f) => ({ main: money(f.loanRM), sub: t("90% of {amt}", { amt: kRM(f.priceRM) }) }),
    },
    {
      id: "instalment",
      label: "Monthly instalment",
      hint: t(m.tenureFromAge ? "4.2% a year over {n} years (to age 70)" : "4.2% a year over {n} years (age unknown)", { n: m.tenureYears }),
      estimated: true,
      cell: (f) => ({ main: money(f.instalmentRM) }),
      value: (f) => f.instalmentRM,
      better: "low",
      lead: perMonthLead,
    },
    {
      id: "down",
      label: "Down payment",
      hint: "10% of the price",
      cell: (f) => ({ main: money(f.downPaymentRM) }),
      value: (f) => f.downPaymentRM,
      better: "low",
    },
    {
      id: "stamp",
      label: "Stamp duty",
      hint: "Transfer (1-4% tiers) + 0.5% on the loan",
      estimated: true,
      cell: (f) => ({
        main: money(f.stampDutyRM + f.loanStampRM),
        sub: f.firstHomeExemptionMayApply
          ? "First-home exemption may apply"
          : t("Transfer {a} + loan {b}", { a: kRM(f.stampDutyRM), b: kRM(f.loanStampRM) }),
        tone: f.firstHomeExemptionMayApply ? "good" : undefined,
      }),
      value: (f) => f.stampDutyRM + f.loanStampRM,
      better: "low",
    },
    {
      id: "legal",
      label: "Legal fees",
      hint: "SPA + loan agreement, scale fees. New launches often waive the SPA fee",
      estimated: true,
      cell: (f) => ({
        main: money(f.spaLegalRM + f.loanLegalRM),
        sub: t("SPA {a} + loan {b}", { a: kRM(f.spaLegalRM), b: kRM(f.loanLegalRM) }),
      }),
      value: (f) => f.spaLegalRM + f.loanLegalRM,
      better: "low",
    },
    {
      id: "upfront",
      label: "Total cash upfront",
      hint:
        m.savingsRM === null
          ? "Down payment, stamp duty, legal fees. Savings unknown"
          : t("Against your {amt} savings", { amt: kRM(m.savingsRM) }),
      strong: true,
      cell: (f) => {
        if (f.savingsGapRM === null) return { main: money(f.upfrontRM) };
        return f.savingsGapRM >= 0
          ? {
              main: money(f.upfrontRM),
              sub: t("{amt} of savings left", { amt: kRM(f.savingsGapRM) }),
              tone: "good",
            }
          : {
              main: money(f.upfrontRM),
              sub: t("{amt} short", { amt: kRM(-f.savingsGapRM) }),
              tone: "bad",
            };
      },
      value: (f) => f.upfrontRM,
      better: "low",
      lead: (g) => t("{amt} less than next", { amt: kRM(g) }),
    },
    {
      id: "maintenance",
      label: "Maintenance / service fee",
      hint: "Per month. Quit rent and assessment not included",
      cell: (f) => ({
        main: t("{amt}/mo", { amt: money(f.maintenanceRM) }),
        sub:
          f.maintenanceSource === "gamuda"
            ? f.maintenanceNote
            : t("{note} (estimated)", { note: f.maintenanceNote }),
      }),
      value: (f) => f.maintenanceRM,
      better: "low",
    },
    {
      id: "monthly",
      label: "Total monthly cost",
      hint: t(anyPartner ? "Instalment + fees + commute ({mode}, both of you)" : "Instalment + fees + commute ({mode})", { mode: modeWord }),
      strong: true,
      estimated: true,
      cell: (f) => ({
        main: t("{amt}/mo", { amt: money(f.totalMonthlyRM) }),
        sub: (
          <>
            {kRM(f.instalmentRM)} {t("loan")} · {money(f.maintenanceRM)} {t("fees")} ·{" "}
            {f.you.compared
              ? t("{amt} commute", { amt: money(f.you.monthlyRM + (f.partner?.monthlyRM ?? 0)) })
              : t("commute not counted")}
          </>
        ),
      }),
      value: (f) => f.totalMonthlyRM,
      better: "low",
      lead: perMonthLead,
    },
    {
      id: "left",
      label: "Money left each month",
      hint:
        m.source === "missing"
          ? "Take-home − other debts − total cost. Needs your salary"
          : t("{a} take-home − {b} other debts − total cost", { a: money(m.netRM), b: money(m.commitmentsRM) }),
      cell: (f) =>
        f.leftRM === null
          ? NO_INCOME
          : {
              main: money(f.leftRM),
              tone:
                f.leftRM < 0
                  ? "bad"
                  : f.leftRM < m.netRM * 0.15
                    ? "warn"
                    : undefined,
            },
      value: (f) => f.leftRM,
      better: "high",
      lead: (g) => t("{amt}/mo more than next", { amt: money(g) }),
    },
    {
      id: "dsr",
      label: "Debt service ratio",
      hint: "All loans ÷ take-home. Most banks stop at 60%, some 70%",
      cell: (f) =>
        f.dsrAfter === null
          ? NO_INCOME
          : {
              main: pct(f.dsrAfter),
              sub: <DsrBar value={f.dsrAfter} />,
              tone:
                f.dsrAfter > 0.7
                  ? "bad"
                  : f.dsrAfter > 0.6
                    ? "warn"
                    : undefined,
            },
      value: (f) => f.dsrAfter,
      better: "low",
    },
    {
      id: "fit",
      label: "Budget fit",
      hint:
        m.source === "missing"
          ? "Needs your salary or the bank check"
          : t("Bank ceiling about {amt}", { amt: kRM(m.maxPriceRM) }),
      cell: (f) =>
        f.fit === "unknown"
          ? NO_INCOME
          : {
              main: fitLabel[f.fit],
              sub:
                f.fit === "in"
                  ? t("{amt} headroom", { amt: kRM(m.maxPriceRM - f.priceRM) })
                  : t("{amt} over", { amt: kRM(f.priceRM - m.maxPriceRM) }),
              tone:
                f.fit === "in" ? "good" : f.fit === "stretch" ? "warn" : "bad",
            },
      value: (f) =>
        f.fit === "unknown"
          ? null
          : f.fit === "in"
            ? 2
            : f.fit === "stretch"
              ? 1
              : 0,
      better: "high",
    },
  ];

  /* ------------------------------------------------------------ commute */
  const c = (f: Fighter) => f.you.cost;
  const commuteRows: Row[] = [
    {
      id: "km",
      label: "Road distance",
      hint: "One way, estimated road km",
      cell: (f) =>
        c(f) ? { main: `${c(f)!.driveKmOneWay.toFixed(1)} km` } : nc(f),
      value: (f) => c(f)?.driveKmOneWay ?? null,
      better: "low",
    },
    {
      id: "drive",
      label: "Drive time",
      hint: "One way at peak; off-peak below",
      mine: ctx.mode !== "train",
      estimated: true,
      cell: (f) =>
        c(f)
          ? {
              main: t("{n} min", { n: c(f)!.driveMinPeak }),
              sub: t("Off-peak ~{n} min", { n: c(f)!.driveMinOffPeak }),
            }
          : nc(f),
      value: (f) => c(f)?.driveMinPeak ?? null,
      better: "low",
      lead: (g) => t("{n} min faster", { n: Math.round(g) }),
    },
    {
      id: "train",
      label: "Train time",
      hint: "Door to door: walk or feeder, ride, transfers",
      mine: ctx.mode !== "car",
      estimated: true,
      cell: (f) => {
        const x = c(f);
        if (!x) return nc(f);
        const access =
          x.stationKm <= 1.2
            ? t("{n} min walk", { n: Math.round((x.stationKm / 5) * 60) })
            : t("{km} km feeder or drive", { km: x.stationKm.toFixed(1) });
        return {
          main: t("{n} min", { n: x.trainMinOneWay }),
          sub: `${x.station} (${x.line}), ${access}`,
        };
      },
      value: (f) => c(f)?.trainMinOneWay ?? null,
      better: "low",
      lead: (g) => t("{n} min faster", { n: Math.round(g) }),
    },
    {
      id: "tolls",
      label: "Tolls",
      hint: "One way, Class 1 car",
      estimated: true,
      cell: (f) => {
        const x = c(f);
        if (!x) return nc(f);
        const names = x.tolls.plazas.map((p) => p.name);
        return {
          main:
            x.tolls.oneWayRM > 0 ? `RM${x.tolls.oneWayRM.toFixed(2)}` : "RM0",
          sub: names.length ? names.join(", ") : "No plaza on our estimate",
        };
      },
      value: (f) => c(f)?.tolls.oneWayRM ?? null,
      better: "low",
    },
    {
      id: "tolls-month",
      label: "Tolls per month",
      hint: t("{days}, both ways", { days }),
      estimated: true,
      cell: (f) => (c(f) ? { main: money(c(f)!.car.tollRM) } : nc(f)),
      value: (f) => c(f)?.car.tollRM ?? null,
      better: "low",
    },
    {
      id: "fuel",
      label: "Fuel + parking per month",
      hint: "RON95 at subsidised price; parking at work",
      estimated: true,
      cell: (f) =>
        c(f)
          ? {
              main: money(c(f)!.car.fuelRM + c(f)!.car.parkingRM),
              sub: t("Fuel {a} · parking {b}", { a: money(c(f)!.car.fuelRM), b: money(c(f)!.car.parkingRM) }),
            }
          : nc(f),
      value: (f) => (c(f) ? c(f)!.car.fuelRM + c(f)!.car.parkingRM : null),
      better: "low",
    },
    {
      id: "fares",
      label: "Train fares per month",
      hint: "Fares plus feeder where the station is far",
      estimated: true,
      cell: (f) =>
        c(f)
          ? {
              main: money(c(f)!.train.totalRM),
              sub: c(f)!.train.accessRM
                ? t("Incl. {amt} feeder", { amt: money(c(f)!.train.accessRM) })
                : undefined,
            }
          : nc(f),
      value: (f) => c(f)?.train.totalRM ?? null,
      better: "low",
    },
    {
      id: "commute-cost",
      label: "Your commute cost",
      hint: t("Per month, {mode}", { mode: modeWord }),
      mine: true,
      strong: true,
      estimated: true,
      cell: (f) =>
        f.you.compared
          ? { main: t("{amt}/mo", { amt: money(f.you.monthlyRM) }), sub: t("By {mode}", { mode: t(youMode(f)) }) }
          : nc(f),
      value: (f) => (f.you.compared ? f.you.monthlyRM : null),
      better: "low",
      lead: perMonthLead,
    },
    {
      id: "hours",
      label: "Hours a year commuting",
      hint: t("Peak, both ways, {days} a week, 48 weeks", { days }),
      mine: true,
      strong: true,
      estimated: true,
      cell: (f) =>
        f.you.compared
          ? {
              main: `${f.you.hoursPerYear} h`,
              sub: t("{n} min one way by {mode} · {d} working days", { n: f.you.oneWayMin, mode: t(youMode(f)), d: Math.round(f.you.hoursPerYear / 8) }),
            }
          : nc(f),
      value: (f) => (f.you.compared ? f.you.hoursPerYear : null),
      better: "low",
      lead: (g) => t("{n} h/yr less than next", { n: Math.round(g) }),
    },
  ];
  if (anyPartner) {
    const partnerName =
      fighters.find((f) => f.partner)?.partner?.label ?? "partner's work";
    commuteRows.push(
      {
        id: "partner-time",
        label: "Partner's commute",
        hint: t("To {name}, same mode, one way at peak", { name: partnerName }),
        estimated: true,
        cell: (f) =>
          f.partner?.compared
            ? {
                main: t("{n} min", { n: f.partner.oneWayMin }),
                sub: t("{h} h a year by {mode}", { h: f.partner.hoursPerYear, mode: t(f.partner.mode) }),
              }
            : nc(f),
        value: (f) => (f.partner?.compared ? f.partner.hoursPerYear : null),
        better: "low",
      },
      {
        id: "partner-cost",
        label: "Partner's commute cost",
        hint: "Per month, included in the total",
        estimated: true,
        cell: (f) =>
          f.partner?.compared
            ? { main: t("{amt}/mo", { amt: money(f.partner.monthlyRM) }) }
            : nc(f),
        value: (f) => (f.partner?.compared ? f.partner.monthlyRM : null),
        better: "low",
      },
    );
  }

  /* ------------------------------------------------------------ worries */
  const worryTone: Record<WorryTone, Tone | undefined> = {
    good: "good",
    warn: "warn",
    bad: "bad",
    unknown: "muted",
  };
  const worryWord: Record<WorryTone, string> = {
    good: "Eases it",
    warn: "Partly",
    bad: "Doesn't help",
    unknown: "Can't tell",
  };
  const worryRows: Row[] = ctx.worries.map((w, i) => ({
    id: `worry-${w}`,
    label: t(painPointLabel[w]),
    hint: i === 0 ? "Your biggest worry" : undefined,
    strong: i === 0,
    cell: (f) => {
      const c = f.worries.find((x) => x.worry === w);
      if (!c) return { main: "Not judged", tone: "muted" };
      return {
        main: worryWord[c.tone],
        sub: c.text,
        tone: worryTone[c.tone],
      };
    },
    value: (f) => f.worries.find((x) => x.worry === w)?.score ?? null,
    better: "high",
  }));

  /* ------------------------------------------------------------ family & schools */
  const schoolTypes = (Object.keys(schoolTypeLabel) as SchoolType[]).filter(
    (t) => fighters.some((f) => f.schools.some((s) => s.type === t)),
  );
  const familyRows: Row[] = [
    {
      id: "beds",
      label: "Bedrooms",
      hint: t("You need {n}", { n: ctx.bedsNeeded }),
      cell: (f) => ({
        main: t("{a} bed · {b} bath", { a: f.unit.beds, b: f.unit.baths }),
        sub: f.bedsShort
          ? t("{n} short", { n: f.bedsShort })
          : f.bedsSpare
            ? t("{n} spare", { n: f.bedsSpare })
            : "Just right",
        tone: f.bedsShort ? "bad" : "good",
      }),
      value: (f) =>
        -f.bedsShort * 100 + Math.min(f.unit.beds, ctx.bedsNeeded + 2),
      better: "high",
    },
  ];
  if (schoolTypes.length === 0) {
    familyRows.push({
      id: "schools-none",
      label: "Schools",
      hint: "Nearest school of each type",
      cell: () => ({
        main: "No data yet",
        sub: "School list still loading for this area",
        tone: "muted",
      }),
    });
  } else {
    for (const t of schoolTypes)
      familyRows.push({
        id: `school-${t}`,
        label: schoolTypeLabel[t],
        hint: "Nearest, straight line. For info, not scored",
        cell: (f) => {
          const s = f.schools.find((x) => x.type === t);
          if (!s) return { main: "None nearby", tone: "muted" };
          return { main: `${s.km.toFixed(1)} km`, sub: s.name };
        },
      });
  }
  if (ctx.parentsMovingIn)
    familyRows.push({
      id: "parents",
      label: "Parents moving in",
      hint: "You said yes",
      cell: (f) =>
        f.unit.landed
          ? {
              main: "Stairs",
              sub: "Check the plan for a ground-floor bedroom",
              tone: ctx.parentsMovingIn ? "warn" : undefined,
            }
          : {
              main: "Single level",
              sub: "Lifts, no stairs inside",
              tone: ctx.parentsMovingIn ? "good" : undefined,
            },
      value: ctx.parentsMovingIn ? (f) => (f.unit.landed ? 0 : 1) : undefined,
      better: "high",
    });
  if (ctx.pets !== false)
    familyRows.push({
      id: "pets",
      label: "Pets",
      hint: ctx.pets ? "You have pets" : "If you get one",
      cell: (f) =>
        f.unit.landed
          ? {
              main: "Usually fine",
              sub: "Landed: follow township guidelines",
              tone: ctx.pets ? "good" : undefined,
            }
          : {
              main: "Check by-laws",
              sub: "Strata rules may limit pets",
              tone: ctx.pets ? "warn" : undefined,
            },
      value: ctx.pets ? (f) => (f.unit.landed ? 1 : 0) : undefined,
      better: "high",
    });

  /* ------------------------------------------------------------ home */
  const homeRows: Row[] = [
    {
      id: "type",
      label: "Type",
      hint:
        ctx.homeType === "either"
          ? undefined
          : t(ctx.homeType === "landed" ? "You want landed" : "You want high-rise"),
      cell: (f) => {
        const wrong =
          ctx.homeType !== "either" &&
          (ctx.homeType === "landed") !== f.unit.landed;
        return {
          main: f.unit.type,
          sub: f.unit.product ?? (f.unit.landed ? "Landed" : "High-rise"),
          tone: wrong ? "bad" : undefined,
        };
      },
    },
    {
      id: "builtup",
      label: "Built-up",
      cell: (f) => ({ main: sqft(f.unit.builtUpSqft) }),
      value: (f) => f.unit.builtUpSqft,
      better: "high",
      lead: (g) => t("{n} sq ft more", { n: Math.round(g).toLocaleString("en-MY") }),
    },
    {
      id: "land",
      label: "Land size",
      cell: (f) =>
        f.unit.landSize
          ? { main: f.unit.landSize }
          : f.unit.landed
            ? { main: "Not listed", tone: "muted" }
            : { main: "Strata", sub: "No individual land", tone: "muted" },
    },
    {
      id: "tenure",
      label: "Tenure",
      cell: (f) => ({
        main: f.unit.tenure,
        sub:
          f.unit.tenure === "Leasehold"
            ? "Ask how many years remain"
            : undefined,
      }),
      value: (f) => (f.unit.tenure === "Freehold" ? 1 : 0),
      better: "high",
    },
    {
      id: "completion",
      label: "Keys",
      hint:
        ctx.underConstructionOk === false
          ? "You want a ready home"
          : ctx.underConstructionOk === true
            ? "You're OK waiting"
            : "Expected completion",
      cell: (f) => ({
        main:
          f.waitYears === 0
            ? t("{year}, ready", { year: f.unit.completion })
            : `${f.unit.completion}`,
        sub: f.waitYears
          ? t(f.waitYears === 1 ? "{n} year to wait" : "{n} years to wait", { n: f.waitYears })
          : undefined,
        tone: f.waitConflict ? "bad" : f.waitYears === 0 ? "good" : undefined,
      }),
      value: (f) => f.waitYears,
      better: "low",
    },
    {
      id: "facilities",
      label: "Facilities",
      hint: "From the project page",
      cell: (f) => ({
        main: (
          <span className="text-xs leading-snug font-normal">
            {f.facilities.slice(0, 3).join(" · ") || "Not listed"}
          </span>
        ),
      }),
    },
    {
      id: "link",
      label: "Official page",
      cell: (f) =>
        f.township.officialUrl
          ? {
              main: (
                <a
                  href={f.township.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold underline decoration-2 underline-offset-4"
                >
                  {f.township.name} site
                </a>
              ),
            }
          : { main: "Not linked yet", tone: "muted" },
    },
  ];

  /* ------------------------------------------------------------ market */
  const marketRows: Row[] = [
    {
      id: "stock",
      label: "Units left",
      hint: "Sample counts. No star: scarce is not better",
      cell: (f) =>
        f.soldOut
          ? { main: "Sold out", sub: f.availability.phase, tone: "bad" }
          : {
              main: t("{a} of {b}", { a: f.availability.left, b: f.availability.total }),
              sub: `${t(f.availability.status)}, ${f.availability.phase}`,
              tone: f.availability.left <= 7 ? "warn" : undefined,
            },
    },
    {
      id: "psf-type",
      label: "Price psf vs similar",
      hint: "Against the average of the same home type we list",
      cell: (f) => ({
        main: signedPct(f.psfVsType),
        sub: t("RM{a} vs RM{b} avg ({n} {type})", { a: Math.round(f.psf), b: Math.round(f.typeAvgPsf), n: f.typeCount, type: `${f.unit.type.toLowerCase()}s` }),
        tone:
          f.psfVsType <= -0.05
            ? "good"
            : f.psfVsType >= 0.1
              ? "warn"
              : undefined,
      }),
      value: (f) => f.psfVsType,
      better: "low",
    },
    {
      id: "status",
      label: "Gamuda status",
      cell: (f) =>
        f.township.status === "completed"
          ? { main: "Completed", sub: "Resale only", tone: "muted" }
          : {
              main: "Selling now",
              sub: f.township.acres
                ? t("{n}-acre township", { n: f.township.acres.toLocaleString("en-MY") })
                : undefined,
            },
    },
    {
      id: "match",
      label: "Match score",
      hint: "The swipe deck's fit for you",
      cell: (f) => ({ main: `${f.match}` }),
      value: (f) => f.match,
      better: "high",
    },
  ];

  return [
    {
      id: "money",
      title: "Money",
      art: wallet,
      blurb: "What it costs to buy, and to live there every month",
      rows: moneyRows,
    },
    {
      id: "commute",
      title: ctx.workLabel ? t("Commute to {name}", { name: ctx.workLabel }) : "Commute",
      art: car,
      blurb: ctx.commuteMissing
        ? t("{why}, then every commute row fills in", { why: t(ctx.commuteMissing) })
        : t(anyPartner ? "{days} a week, plus your partner" : "{days} a week", { days }),
      rows: commuteRows,
    },
    ...(worryRows.length
      ? [
          {
            id: "worries",
            title: "Your worries",
            art: "heart" as const,
            blurb: "How each home does on what you told Mochi worries you most",
            rows: worryRows,
          },
        ]
      : []),
    { id: "family", title: "Family & home life", art: family, rows: familyRows },
    { id: "home", title: "The home", art: home, rows: homeRows },
    { id: "market", title: "Market", art: chart, rows: marketRows },
  ];
}
