import type { ReactNode } from "react";
import type { SpriteArt, SpriteName } from "@/components/homelander/sprite";
import { schoolTypeLabel, type SchoolType } from "@/lib/homelander/schools";
import type { BattleContext } from "@/lib/homelander/battle-context";
import type { Fighter } from "@/lib/homelander/battle-verdict";
import type { Fit } from "@/lib/homelander/analysis";
import type { TFn } from "@/lib/homelander/i18n/translate";
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
};
export const fitTone: Record<Fit, "pandan" | "kaya" | "raya"> = {
  in: "pandan",
  stretch: "kaya",
  over: "raya",
};

/** `tr` is the caller's translator (useT), so every sentence below follows the EN | Manglish switch. */
export function buildSections(
  fighters: Fighter[],
  ctx: BattleContext,
  tr: TFn,
): Section[] {
  const NC: Cell = {
    main: tr("Not compared"),
    sub: tr("Not a daily commute"),
    tone: "muted",
  };
  const perMonthLead = (g: number) => tr("{amount}/mo less than next", { amount: money(g) });
  const m = ctx.money;
  const anyPartner = fighters.some((f) => f.partner);
  const youMode = (f: Fighter) => f.you.mode;
  const modeWord =
    ctx.mode === "fastest"
      ? tr("faster of car or train")
      : ctx.mode === "car"
        ? tr("driving")
        : tr("train");
  const by = (mode: string) => (mode === "train" ? tr("by train") : tr("by car"));

  /* ------------------------------------------------------------ money */
  const moneyRows: Row[] = [
    {
      id: "price",
      label: tr("Price"),
      hint: fighters.some((f) => f.unit.source !== "official")
        ? tr("Sample or listed price, before rebates")
        : tr("Listed price, before rebates"),
      cell: (f) => ({
        main: money(f.priceRM),
        sub:
          f.unit.source === "official" ? tr("Gamuda Land listing") : tr("Sample price"),
      }),
      value: (f) => f.priceRM,
      better: "low",
      lead: (g) => tr("{amount} under next", { amount: kRM(g) }),
    },
    {
      id: "psf",
      label: tr("Price per sq ft"),
      cell: (f) => ({
        main: `RM${Math.round(f.psf)}`,
        sub: tr("{n} sq ft built-up", { n: f.unit.builtUpSqft.toLocaleString("en-MY") }),
      }),
      value: (f) => f.psf,
      better: "low",
    },
    {
      id: "loan",
      label: tr("Loan"),
      hint:
        m.firstHome === true
          ? tr("90% margin: the usual cap on a first home")
          : tr("90% margin, usual for a 1st or 2nd home loan; a 3rd is capped at 70%"),
      cell: (f) => ({ main: money(f.loanRM), sub: tr("90% of {amount}", { amount: kRM(f.priceRM) }) }),
    },
    {
      id: "instalment",
      label: tr("Monthly instalment"),
      hint: m.tenureFromAge
        ? tr("4.2% a year over {n} years (to age 70)", { n: m.tenureYears })
        : tr("4.2% a year over {n} years (age unknown)", { n: m.tenureYears }),
      estimated: true,
      cell: (f) => ({ main: money(f.instalmentRM) }),
      value: (f) => f.instalmentRM,
      better: "low",
      lead: perMonthLead,
    },
    {
      id: "down",
      label: tr("Down payment"),
      hint: tr("10% of the price"),
      cell: (f) => ({ main: money(f.downPaymentRM) }),
      value: (f) => f.downPaymentRM,
      better: "low",
    },
    {
      id: "stamp",
      label: tr("Stamp duty"),
      hint: tr("Transfer (1-4% tiers) + 0.5% on the loan"),
      estimated: true,
      cell: (f) => ({
        main: money(f.stampDutyRM + f.loanStampRM),
        sub: f.firstHomeExemptionMayApply
          ? tr("First-home exemption may apply")
          : tr("Transfer {a} + loan {b}", { a: kRM(f.stampDutyRM), b: kRM(f.loanStampRM) }),
        tone: f.firstHomeExemptionMayApply ? "good" : undefined,
      }),
      value: (f) => f.stampDutyRM + f.loanStampRM,
      better: "low",
    },
    {
      id: "legal",
      label: tr("Legal fees"),
      hint: tr("SPA + loan agreement, scale fees. New launches often waive the SPA fee"),
      estimated: true,
      cell: (f) => ({
        main: money(f.spaLegalRM + f.loanLegalRM),
        sub: tr("SPA {a} + loan {b}", { a: kRM(f.spaLegalRM), b: kRM(f.loanLegalRM) }),
      }),
      value: (f) => f.spaLegalRM + f.loanLegalRM,
      better: "low",
    },
    {
      id: "upfront",
      label: tr("Total cash upfront"),
      hint:
        m.savingsRM === null
          ? tr("Down payment, stamp duty, legal fees. Savings unknown")
          : tr("Against your {amount} savings", { amount: kRM(m.savingsRM) }),
      strong: true,
      cell: (f) => {
        if (f.savingsGapRM === null) return { main: money(f.upfrontRM) };
        return f.savingsGapRM >= 0
          ? {
              main: money(f.upfrontRM),
              sub: tr("{amount} of savings left", { amount: kRM(f.savingsGapRM) }),
              tone: "good",
            }
          : {
              main: money(f.upfrontRM),
              sub: tr("{amount} short", { amount: kRM(-f.savingsGapRM) }),
              tone: "bad",
            };
      },
      value: (f) => f.upfrontRM,
      better: "low",
      lead: (g) => tr("{amount} less than next", { amount: kRM(g) }),
    },
    {
      id: "maintenance",
      label: tr("Maintenance / service fee"),
      hint: tr("Per month. Quit rent and assessment not included"),
      cell: (f) => ({
        main: `${money(f.maintenanceRM)}/mo`,
        sub:
          f.maintenanceSource === "gamuda"
            ? f.maintenanceNote
            : tr("{note} (estimated)", { note: f.maintenanceNote }),
      }),
      value: (f) => f.maintenanceRM,
      better: "low",
    },
    {
      id: "monthly",
      label: tr("Total monthly cost"),
      hint: anyPartner
        ? tr("Instalment + fees + commute ({mode}, both of you)", { mode: modeWord })
        : tr("Instalment + fees + commute ({mode})", { mode: modeWord }),
      strong: true,
      estimated: true,
      cell: (f) => ({
        main: `${money(f.totalMonthlyRM)}/mo`,
        sub: (
          <>
            {tr("{a} loan · {b} fees · {c}", {
              a: kRM(f.instalmentRM),
              b: money(f.maintenanceRM),
              c: f.you.compared
                ? tr("{amount} commute", { amount: money(f.you.monthlyRM + (f.partner?.monthlyRM ?? 0)) })
                : tr("commute not counted"),
            })}
          </>
        ),
      }),
      value: (f) => f.totalMonthlyRM,
      better: "low",
      lead: perMonthLead,
    },
    {
      id: "left",
      label: tr("Money left each month"),
      hint: tr("{a} take-home − {b} other debts − total cost", { a: money(m.netRM), b: money(m.commitmentsRM) }),
      cell: (f) => ({
        main: money(f.leftRM),
        tone:
          f.leftRM < 0 ? "bad" : f.leftRM < m.netRM * 0.15 ? "warn" : undefined,
      }),
      value: (f) => f.leftRM,
      better: "high",
      lead: (g) => tr("{amount}/mo more than next", { amount: money(g) }),
    },
    {
      id: "dsr",
      label: tr("Debt service ratio"),
      hint: tr("All loans ÷ take-home. Most banks stop at 60%, some 70%"),
      cell: (f) => ({
        main: pct(f.dsrAfter),
        sub: <DsrBar value={f.dsrAfter} />,
        tone: f.dsrAfter > 0.7 ? "bad" : f.dsrAfter > 0.6 ? "warn" : undefined,
      }),
      value: (f) => f.dsrAfter,
      better: "low",
    },
    {
      id: "fit",
      label: tr("Budget fit"),
      hint:
        m.source === "sample"
          ? tr("Bank ceiling about {amount} (sample payslip)", { amount: kRM(m.maxPriceRM) })
          : tr("Bank ceiling about {amount}", { amount: kRM(m.maxPriceRM) }),
      cell: (f) => ({
        main: tr(fitLabel[f.fit]),
        sub:
          f.fit === "in"
            ? tr("{amount} headroom", { amount: kRM(m.maxPriceRM - f.priceRM) })
            : tr("{amount} over", { amount: kRM(f.priceRM - m.maxPriceRM) }),
        tone: f.fit === "in" ? "good" : f.fit === "stretch" ? "warn" : "bad",
      }),
      value: (f) => (f.fit === "in" ? 2 : f.fit === "stretch" ? 1 : 0),
      better: "high",
    },
  ];

  /* ------------------------------------------------------------ commute */
  const c = (f: Fighter) => f.you.cost;
  const commuteRows: Row[] = [
    {
      id: "km",
      label: tr("Road distance"),
      hint: tr("One way, estimated road km"),
      cell: (f) =>
        c(f) ? { main: `${c(f)!.driveKmOneWay.toFixed(1)} km` } : NC,
      value: (f) => c(f)?.driveKmOneWay ?? null,
      better: "low",
    },
    {
      id: "drive",
      label: tr("Drive time"),
      hint: tr("One way at peak; off-peak below"),
      mine: ctx.mode !== "train",
      estimated: true,
      cell: (f) =>
        c(f)
          ? {
              main: `${c(f)!.driveMinPeak} min`,
              sub: tr("Off-peak ~{n} min", { n: c(f)!.driveMinOffPeak }),
            }
          : NC,
      value: (f) => c(f)?.driveMinPeak ?? null,
      better: "low",
      lead: (g) => tr("{n} min faster", { n: Math.round(g) }),
    },
    {
      id: "train",
      label: tr("Train time"),
      hint: tr("Door to door: walk or feeder, ride, transfers"),
      mine: ctx.mode !== "car",
      estimated: true,
      cell: (f) => {
        const x = c(f);
        if (!x) return NC;
        const access =
          x.stationKm <= 1.2
            ? tr("{n} min walk", { n: Math.round((x.stationKm / 5) * 60) })
            : tr("{km} km feeder or drive", { km: x.stationKm.toFixed(1) });
        return {
          main: `${x.trainMinOneWay} min`,
          sub: `${x.station} (${x.line}), ${access}`,
        };
      },
      value: (f) => c(f)?.trainMinOneWay ?? null,
      better: "low",
      lead: (g) => tr("{n} min faster", { n: Math.round(g) }),
    },
    {
      id: "tolls",
      label: tr("Tolls"),
      hint: tr("One way, Class 1 car"),
      estimated: true,
      cell: (f) => {
        const x = c(f);
        if (!x) return NC;
        const names = x.tolls.plazas.map((p) => p.name);
        return {
          main:
            x.tolls.oneWayRM > 0 ? `RM${x.tolls.oneWayRM.toFixed(2)}` : "RM0",
          sub: names.length ? names.join(", ") : tr("No plaza on our estimate"),
        };
      },
      value: (f) => c(f)?.tolls.oneWayRM ?? null,
      better: "low",
    },
    {
      id: "tolls-month",
      label: tr("Tolls per month"),
      hint: tr("{n} office days, both ways", { n: ctx.officeDays }),
      estimated: true,
      cell: (f) => (c(f) ? { main: money(c(f)!.car.tollRM) } : NC),
      value: (f) => c(f)?.car.tollRM ?? null,
      better: "low",
    },
    {
      id: "fuel",
      label: tr("Fuel + parking per month"),
      hint: tr("RON95 at subsidised price; parking at work"),
      estimated: true,
      cell: (f) =>
        c(f)
          ? {
              main: money(c(f)!.car.fuelRM + c(f)!.car.parkingRM),
              sub: tr("Fuel {a} · parking {b}", { a: money(c(f)!.car.fuelRM), b: money(c(f)!.car.parkingRM) }),
            }
          : NC,
      value: (f) => (c(f) ? c(f)!.car.fuelRM + c(f)!.car.parkingRM : null),
      better: "low",
    },
    {
      id: "fares",
      label: tr("Train fares per month"),
      hint: tr("Fares plus feeder where the station is far"),
      estimated: true,
      cell: (f) =>
        c(f)
          ? {
              main: money(c(f)!.train.totalRM),
              sub: c(f)!.train.accessRM
                ? tr("Incl. {amount} feeder", { amount: money(c(f)!.train.accessRM) })
                : undefined,
            }
          : NC,
      value: (f) => c(f)?.train.totalRM ?? null,
      better: "low",
    },
    {
      id: "commute-cost",
      label: tr("Your commute cost"),
      hint: tr("Per month, {mode}", { mode: modeWord }),
      mine: true,
      strong: true,
      estimated: true,
      cell: (f) =>
        f.you.compared
          ? { main: `${money(f.you.monthlyRM)}/mo`, sub: tr("By {mode}", { mode: youMode(f) === "train" ? tr("train") : tr("car") }) }
          : NC,
      value: (f) => (f.you.compared ? f.you.monthlyRM : null),
      better: "low",
      lead: perMonthLead,
    },
    {
      id: "hours",
      label: tr("Hours a year commuting"),
      hint: tr("Peak, both ways, {n} days a week, 48 weeks", { n: ctx.officeDays }),
      mine: true,
      strong: true,
      estimated: true,
      cell: (f) =>
        f.you.compared
          ? {
              main: `${f.you.hoursPerYear} h`,
              sub: tr("{n} min one way {by} · {d} working days", { n: f.you.oneWayMin, by: by(youMode(f)), d: Math.round(f.you.hoursPerYear / 8) }),
            }
          : NC,
      value: (f) => (f.you.compared ? f.you.hoursPerYear : null),
      better: "low",
      lead: (g) => tr("{n} h/yr less than next", { n: Math.round(g) }),
    },
  ];
  if (anyPartner) {
    const partnerName =
      fighters.find((f) => f.partner)?.partner?.anchor.name ?? tr("partner's work");
    commuteRows.push(
      {
        id: "partner-time",
        label: tr("Partner's commute"),
        hint: tr("To {name}, same mode, one way at peak", { name: partnerName }),
        estimated: true,
        cell: (f) =>
          f.partner?.compared
            ? {
                main: `${f.partner.oneWayMin} min`,
                sub: tr("{n} h a year {by}", { n: f.partner.hoursPerYear, by: by(f.partner.mode) }),
              }
            : NC,
        value: (f) => (f.partner?.compared ? f.partner.hoursPerYear : null),
        better: "low",
      },
      {
        id: "partner-cost",
        label: tr("Partner's commute cost"),
        hint: tr("Per month, included in the total"),
        estimated: true,
        cell: (f) =>
          f.partner?.compared
            ? { main: `${money(f.partner.monthlyRM)}/mo` }
            : NC,
        value: (f) => (f.partner?.compared ? f.partner.monthlyRM : null),
        better: "low",
      },
    );
  }

  /* ------------------------------------------------------------ family & schools */
  const schoolTypes = (Object.keys(schoolTypeLabel) as SchoolType[]).filter(
    (t) => fighters.some((f) => f.schools.some((s) => s.type === t)),
  );
  const familyRows: Row[] = [
    {
      id: "beds",
      label: tr("Bedrooms"),
      hint: ctx.hasProfile
        ? tr("You need {n}", { n: ctx.bedsNeeded })
        : tr("You need {n} (default)", { n: ctx.bedsNeeded }),
      cell: (f) => ({
        main: `${f.unit.beds} bed · ${f.unit.baths} bath`,
        sub: f.bedsShort
          ? tr("{n} short", { n: f.bedsShort })
          : f.bedsSpare
            ? tr("{n} spare", { n: f.bedsSpare })
            : tr("Just right"),
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
      label: tr("Schools"),
      hint: tr("Nearest school of each type"),
      cell: () => ({
        main: tr("No data yet"),
        sub: tr("School list still loading for this area"),
        tone: "muted",
      }),
    });
  } else {
    for (const t of schoolTypes)
      familyRows.push({
        id: `school-${t}`,
        label: tr(schoolTypeLabel[t]),
        hint: ctx.schoolMatters
          ? tr("Nearest; within {km} km is what you asked", { km: ctx.schoolMaxKm })
          : tr("Nearest, straight line"),
        cell: (f) => {
          const s = f.schools.find((x) => x.type === t);
          if (!s) return { main: tr("None nearby"), tone: "muted" };
          return {
            main: `${s.km.toFixed(1)} km`,
            sub: s.name,
            tone:
              s.within === true
                ? "good"
                : s.within === false
                  ? "bad"
                  : undefined,
          };
        },
        value: (f) => f.schools.find((x) => x.type === t)?.km ?? null,
        better: "low",
      });
    if (ctx.schoolMatters)
      familyRows.push({
        id: "school-check",
        label: tr("Within your {km} km", { km: ctx.schoolMaxKm }),
        hint:
          ctx.schoolTransport === "walk"
            ? tr("You said they'll walk: under 1.5 km is kinder")
            : ctx.schoolTransport === "school_bus"
              ? tr("School bus: distance matters less")
              : tr("Primary and secondary"),
        cell: (f) => {
          const p = f.primaryWithin ? tr("Primary yes") : tr("Primary no");
          const s = f.secondaryWithin ? tr("secondary yes") : tr("secondary no");
          const n = Number(f.primaryWithin) + Number(f.secondaryWithin);
          return {
            main: tr("{n} of 2", { n }),
            sub: `${p}, ${s}`,
            tone: n === 2 ? "good" : n === 0 ? "bad" : "warn",
          };
        },
        value: (f) => Number(f.primaryWithin) + Number(f.secondaryWithin),
        better: "high",
      });
  }
  if (ctx.parentsMovingIn || !ctx.hasProfile)
    familyRows.push({
      id: "parents",
      label: tr("Parents moving in"),
      hint: ctx.parentsMovingIn ? tr("You said yes") : tr("In case they do"),
      cell: (f) =>
        f.unit.landed
          ? {
              main: tr("Stairs"),
              sub: tr("Check the plan for a ground-floor bedroom"),
              tone: ctx.parentsMovingIn ? "warn" : undefined,
            }
          : {
              main: tr("Single level"),
              sub: tr("Lifts, no stairs inside"),
              tone: ctx.parentsMovingIn ? "good" : undefined,
            },
      value: ctx.parentsMovingIn ? (f) => (f.unit.landed ? 0 : 1) : undefined,
      better: "high",
    });
  if (ctx.pets !== false)
    familyRows.push({
      id: "pets",
      label: tr("Pets"),
      hint: ctx.pets ? tr("You have pets") : tr("If you get one"),
      cell: (f) =>
        f.unit.landed
          ? {
              main: tr("Usually fine"),
              sub: tr("Landed: follow township guidelines"),
              tone: ctx.pets ? "good" : undefined,
            }
          : {
              main: tr("Check by-laws"),
              sub: tr("Strata rules may limit pets"),
              tone: ctx.pets ? "warn" : undefined,
            },
      value: ctx.pets ? (f) => (f.unit.landed ? 1 : 0) : undefined,
      better: "high",
    });

  /* ------------------------------------------------------------ home */
  const homeRows: Row[] = [
    {
      id: "type",
      label: tr("Type"),
      hint:
        ctx.homeType === "either"
          ? undefined
          : ctx.homeType === "landed"
            ? tr("You want landed")
            : tr("You want high-rise"),
      cell: (f) => {
        const wrong =
          ctx.homeType !== "either" &&
          (ctx.homeType === "landed") !== f.unit.landed;
        return {
          main: f.unit.type,
          sub: f.unit.product ?? (f.unit.landed ? tr("Landed") : tr("High-rise")),
          tone: wrong ? "bad" : undefined,
        };
      },
    },
    {
      id: "builtup",
      label: tr("Built-up"),
      cell: (f) => ({ main: sqft(f.unit.builtUpSqft) }),
      value: (f) => f.unit.builtUpSqft,
      better: "high",
      lead: (g) => tr("{n} sq ft more", { n: Math.round(g).toLocaleString("en-MY") }),
    },
    {
      id: "land",
      label: tr("Land size"),
      cell: (f) =>
        f.unit.landSize
          ? { main: f.unit.landSize }
          : f.unit.landed
            ? { main: tr("Not listed"), tone: "muted" }
            : { main: tr("Strata"), sub: tr("No individual land"), tone: "muted" },
    },
    {
      id: "tenure",
      label: tr("Tenure"),
      cell: (f) => ({
        main: f.unit.tenure,
        sub:
          f.unit.tenure === "Leasehold"
            ? tr("Ask how many years remain")
            : undefined,
      }),
      value: (f) => (f.unit.tenure === "Freehold" ? 1 : 0),
      better: "high",
    },
    {
      id: "completion",
      label: tr("Keys"),
      hint:
        ctx.underConstructionOk === false
          ? tr("You want a ready home")
          : ctx.underConstructionOk === true
            ? tr("You're OK waiting")
            : tr("Expected completion"),
      cell: (f) => ({
        main:
          f.waitYears === 0
            ? tr("{year}, ready", { year: f.unit.completion })
            : `${f.unit.completion}`,
        sub: f.waitYears
          ? f.waitYears === 1
            ? tr("{n} year to wait", { n: f.waitYears })
            : tr("{n} years to wait", { n: f.waitYears })
          : undefined,
        tone: f.waitConflict ? "bad" : f.waitYears === 0 ? "good" : undefined,
      }),
      value: (f) => f.waitYears,
      better: "low",
    },
    {
      id: "facilities",
      label: tr("Facilities"),
      hint: tr("From the project page"),
      cell: (f) => ({
        main: (
          <span className="text-xs leading-snug font-normal">
            {f.facilities.slice(0, 3).join(" · ") || tr("Not listed")}
          </span>
        ),
      }),
    },
    {
      id: "link",
      label: tr("Official page"),
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
                  {tr("{name} site", { name: f.township.name })}
                </a>
              ),
            }
          : { main: tr("Not linked yet"), tone: "muted" },
    },
  ];

  /* ------------------------------------------------------------ market */
  const marketRows: Row[] = [
    {
      id: "stock",
      label: tr("Units left"),
      hint: tr("Sample counts. No star: scarce is not better"),
      cell: (f) =>
        f.soldOut
          ? { main: tr("Sold out"), sub: f.availability.phase, tone: "bad" }
          : {
              main: tr("{a} of {b}", { a: f.availability.left, b: f.availability.total }),
              sub: `${tr(f.availability.status)}, ${f.availability.phase}`,
              tone: f.availability.left <= 7 ? "warn" : undefined,
            },
    },
    {
      id: "psf-type",
      label: tr("Price psf vs similar"),
      hint: tr("Against the average of the same home type we list"),
      cell: (f) => ({
        main: signedPct(f.psfVsType),
        sub: tr("RM{a} vs RM{b} avg ({n} {type}s)", { a: Math.round(f.psf), b: Math.round(f.typeAvgPsf), n: f.typeCount, type: f.unit.type.toLowerCase() }),
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
      label: tr("Gamuda status"),
      cell: (f) =>
        f.township.status === "completed"
          ? { main: tr("Completed"), sub: tr("Resale only"), tone: "muted" }
          : {
              main: tr("Selling now"),
              sub: f.township.acres
                ? tr("{n}-acre township", { n: f.township.acres.toLocaleString("en-MY") })
                : undefined,
            },
    },
    {
      id: "match",
      label: tr("Match score"),
      hint: tr("The swipe deck's fit for you"),
      cell: (f) => ({ main: `${f.match}` }),
      value: (f) => f.match,
      better: "high",
    },
  ];

  return [
    {
      id: "money",
      title: tr("Money"),
      art: wallet,
      blurb: tr("What it costs to buy, and to live there every month"),
      rows: moneyRows,
    },
    {
      id: "commute",
      title: tr("Commute to {place}", { place: ctx.workLabel }),
      art: car,
      blurb: anyPartner
        ? tr("{n} office days a week, plus your partner", { n: ctx.officeDays })
        : tr("{n} office days a week", { n: ctx.officeDays }),
      rows: commuteRows,
    },
    { id: "family", title: tr("Family & schools"), art: family, rows: familyRows },
    { id: "home", title: tr("The home"), art: home, rows: homeRows },
    { id: "market", title: tr("Market"), art: chart, rows: marketRows },
  ];
}
