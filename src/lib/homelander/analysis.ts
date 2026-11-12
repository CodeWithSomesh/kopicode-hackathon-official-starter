import { commuteCost, type CommuteCost } from "./commute-cost";
import {
  availabilityOf,
  distanceKm,
  LOAN_RATE,
  legalFees,
  MARGIN,
  monthlyInstalment,
  nearestStation,
  townshipById,
  transferStampDuty,
  units as allUnits,
  type Anchor,
  type Availability,
  type Region,
  type Township,
  type Unit,
} from "./data";
import { nearestByType, schoolTypeLabel, type SchoolType } from "./schools";
import type { BattleContext } from "./battle-context";

/**
 * Head-to-head analysis for Battle. Pure functions: one home + the buyer context in, every
 * figure the comparison table, scores and verdict need out. Every money figure is an
 * ESTIMATE (rates, fees and commute costs are modelled), never a quote or a loan offer.
 */

/* ---------------------------------------------------------------- assumptions */

/** Strata maintenance when Gamuda has not published one: RM per sq ft per month (estimate). */
export const EST_STRATA_PSF = 0.35;
/** Sinking fund is 10% of the maintenance charge by law (Strata Management Act 2013). */
export const SINKING_FUND_SHARE = 0.1;
/** Guarded-community fee for landed homes when none is published (estimate). */
export const EST_LANDED_FEE_RM = 150;
/** Loan agreement stamp duty: 0.5% of the loan. */
export const LOAN_STAMP_RATE = 0.005;
/** First-time buyer stamp duty exemption is for homes up to this price (current scheme; may change). */
export const FIRST_HOME_EXEMPTION_CAP = 500_000;
/** Price over the bank ceiling we still call a "stretch". */
export const STRETCH_SHARE = 0.1;
/** Beyond this straight-line distance a daily commute is not compared. */
export const MAX_COMMUTE_KM = 120;
export const DSR_LINES = [0.6, 0.7] as const;

/* ---------------------------------------------------------------- types */

export type EffectiveMode = "car" | "train";

export type CommuteLeg = {
  who: "you" | "partner";
  anchor: Anchor | null;
  label: string;
  /** False for homes too far to commute daily (Johor, Sabah vs a KL office), or when an input is missing. */
  compared: boolean;
  /** What the buyer still has to tell Mochi before this commute can be compared; null when nothing. */
  missing: string | null;
  notComparedWhy: string | null;
  cost: CommuteCost | null;
  mode: EffectiveMode;
  oneWayMin: number;
  hoursPerYear: number;
  /** Monthly cost in the mode used. */
  monthlyRM: number;
};

export type SchoolCell = {
  type: SchoolType;
  label: string;
  name: string;
  km: number;
  within: boolean | null;
};

export type Fit = "in" | "stretch" | "over" | "unknown";

export type HomeAnalysis = {
  unit: Unit;
  township: Township;
  availability: Availability;
  region: Region;
  soldOut: boolean;

  /* money */
  priceRM: number;
  psf: number;
  loanRM: number;
  tenureYears: number;
  instalmentRM: number;
  downPaymentRM: number;
  stampDutyRM: number;
  loanStampRM: number;
  spaLegalRM: number;
  loanLegalRM: number;
  upfrontRM: number;
  /** Savings minus cash upfront; null when savings are unknown. Negative is a shortfall. */
  savingsGapRM: number | null;
  firstHomeExemptionMayApply: boolean;
  maintenanceRM: number;
  maintenanceSource: "gamuda" | "estimated";
  maintenanceNote: string;
  totalMonthlyRM: number;
  /** Take-home minus other debts minus the total monthly cost; null when income is unknown. */
  leftRM: number | null;
  /** Debt service ratio with this loan; null when income is unknown. */
  dsrAfter: number | null;
  fit: Fit;

  /* commute */
  you: CommuteLeg;
  partner: CommuteLeg | null;

  /* family */
  bedsShort: number;
  bedsSpare: number;
  schools: SchoolCell[];
  primaryWithin: boolean | null;
  secondaryWithin: boolean | null;
  stationKm: number;
  stationName: string;

  /* home */
  waitYears: number;
  waitConflict: boolean;
  facilities: string[];

  /* market */
  typeAvgPsf: number;
  typeCount: number;
  /** Fraction above (+) or below (-) the average psf of the same home type. */
  psfVsType: number;
};

/* ---------------------------------------------------------------- helpers */

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function regionOf(t: Township): Region {
  if (t.region) return t.region;
  if (t.state === "Johor") return "johor";
  if (t.state === "Sabah") return "sabah";
  if (t.pos.lng > 109) return "sabah";
  if (t.pos.lat < 2.3) return "johor";
  return "klang-valley";
}

export const regionName: Record<Region, string> = {
  "klang-valley": "the Klang Valley",
  johor: "Johor",
  sabah: "Sabah",
};

/** Average RM psf of every listed unit of a home type (whole catalogue, so swaps do not move it). */
export function typeAveragePsf(type: Unit["type"]) {
  const same = allUnits.filter((u) => u.type === type && u.builtUpSqft > 0);
  const pool =
    same.length >= 2 ? same : allUnits.filter((u) => u.builtUpSqft > 0);
  const avg =
    pool.reduce((s, u) => s + u.priceRM / u.builtUpSqft, 0) /
    Math.max(pool.length, 1);
  return { avg, count: pool.length, sameType: same.length >= 2 };
}

export function fitOf(price: number, maxPrice: number): Fit {
  if (maxPrice <= 0) return "unknown";
  if (maxPrice > 0 && price <= maxPrice) return "in";
  if (maxPrice > 0 && price <= maxPrice * (1 + STRETCH_SHARE)) return "stretch";
  return "over";
}

export function maintenanceOf(unit: Unit): {
  rm: number;
  source: "gamuda" | "estimated";
  note: string;
} {
  if (unit.maintenancePsfRM && unit.maintenancePsfRM > 0) {
    const base = unit.maintenancePsfRM * unit.builtUpSqft;
    const total = Math.round(base * (1 + SINKING_FUND_SHARE));
    return {
      rm: total,
      source: unit.source === "official" ? "gamuda" : "estimated",
      note: `RM${unit.maintenancePsfRM.toFixed(2)} psf + 10% sinking fund`,
    };
  }
  if (unit.serviceRM && unit.serviceRM > 0)
    return {
      rm: Math.round(unit.serviceRM),
      source: unit.source === "official" ? "gamuda" : "estimated",
      note: "Guarded-community fee",
    };
  if (!unit.landed)
    return {
      rm: Math.round(
        unit.builtUpSqft * EST_STRATA_PSF * (1 + SINKING_FUND_SHARE),
      ),
      source: "estimated",
      note: `Est. RM${EST_STRATA_PSF.toFixed(2)} psf + 10% sinking fund`,
    };
  return {
    rm: EST_LANDED_FEE_RM,
    source: "estimated",
    note: "Est. guard and landscaping fee",
  };
}

/** A leg we can't compare because the buyer hasn't told Mochi something yet. */
function missingLeg(
  who: "you" | "partner",
  anchor: Anchor | null,
  why: string,
): CommuteLeg {
  return {
    who,
    anchor,
    label: anchor?.name ?? "work",
    compared: false,
    missing: why,
    notComparedWhy: why,
    cost: null,
    mode: "car",
    oneWayMin: 0,
    hoursPerYear: 0,
    monthlyRM: 0,
  };
}

function commuteLeg(
  t: Township,
  anchor: Anchor,
  label: string,
  who: "you" | "partner",
  ctx: BattleContext,
): CommuteLeg {
  if (ctx.officeDays === null || ctx.mode === null)
    return missingLeg(
      who,
      anchor,
      ctx.commuteMissing ?? "Tell Mochi how you commute",
    );
  const officeDays = ctx.officeDays;
  const ctxMode = ctx.mode;
  const region = regionOf(t);
  const km = distanceKm(t.pos, anchor.pos);
  // Every commute anchor is in the Klang Valley, so a Johor or Sabah home is not a daily commute.
  if (region !== "klang-valley" || km > MAX_COMMUTE_KM) {
    return {
      who,
      anchor,
      label,
      compared: false,
      missing: null,
      notComparedWhy: `${t.name} is in ${regionName[region]}, about ${Math.round(km)} km from ${anchor.name}. Not a daily commute.`,
      cost: null,
      mode: ctxMode === "train" ? "train" : "car",
      oneWayMin: 0,
      hoursPerYear: 0,
      monthlyRM: 0,
    };
  }
  const cost = commuteCost(t.pos, anchor, officeDays);
  const mode: EffectiveMode =
    ctxMode === "fastest"
      ? cost.trainMinOneWay < cost.driveMinPeak
        ? "train"
        : "car"
      : ctxMode;
  return {
    who,
    anchor,
    label,
    compared: true,
    missing: null,
    notComparedWhy: null,
    cost,
    mode,
    oneWayMin: mode === "car" ? cost.driveMinPeak : cost.trainMinOneWay,
    hoursPerYear: cost.hoursPerYear[mode],
    monthlyRM: mode === "car" ? cost.car.totalRM : cost.train.totalRM,
  };
}

const PRIMARY: SchoolType[] = [
  "national_primary",
  "chinese_primary",
  "tamil_primary",
];

/* ---------------------------------------------------------------- one home */

export function analyseHome(unit: Unit, ctx: BattleContext): HomeAnalysis {
  const township = townshipById[unit.townshipId]!;
  const availability = availabilityOf(unit.id);
  const region = regionOf(township);
  const m = ctx.money;

  const priceRM = unit.priceRM;
  const psf = unit.builtUpSqft > 0 ? priceRM / unit.builtUpSqft : 0;
  const loanRM = priceRM * MARGIN;
  const tenure = Math.max(m.tenureYears, 1);
  const instalmentRM = monthlyInstalment(loanRM, LOAN_RATE, tenure);
  const downPaymentRM = priceRM - loanRM;
  const stampDutyRM = transferStampDuty(priceRM);
  const loanStampRM = Math.round(loanRM * LOAN_STAMP_RATE);
  const spaLegalRM = legalFees(priceRM);
  const loanLegalRM = legalFees(loanRM);
  const upfrontRM = Math.round(
    downPaymentRM + stampDutyRM + loanStampRM + spaLegalRM + loanLegalRM,
  );
  const savingsGapRM = m.savingsRM === null ? null : m.savingsRM - upfrontRM;
  const firstHomeExemptionMayApply =
    m.firstHome !== false && priceRM <= FIRST_HOME_EXEMPTION_CAP;

  const maint = maintenanceOf(unit);

  const you = ctx.work
    ? commuteLeg(township, ctx.work, ctx.workLabel ?? ctx.work.name, "you", ctx)
    : missingLeg(
        "you",
        null,
        ctx.commuteMissing ?? "Tell Mochi where you work",
      );
  const partner = ctx.partner
    ? commuteLeg(
        township,
        ctx.partner,
        ctx.partnerLabel ?? ctx.partner.name,
        "partner",
        ctx,
      )
    : null;

  const totalMonthlyRM = Math.round(
    instalmentRM + maint.rm + you.monthlyRM + (partner?.monthlyRM ?? 0),
  );
  const incomeKnown = m.source !== "missing" && m.netRM > 0;
  const leftRM = incomeKnown
    ? Math.round(m.netRM - m.commitmentsRM - totalMonthlyRM)
    : null;
  const dsrAfter = incomeKnown
    ? (m.commitmentsRM + instalmentRM) / m.netRM
    : null;

  const bedsShort = Math.max(ctx.bedsNeeded - unit.beds, 0);
  const bedsSpare = Math.max(unit.beds - ctx.bedsNeeded, 0);

  const near = nearestByType(township.pos);
  const schools: SchoolCell[] = (
    Object.keys(schoolTypeLabel) as SchoolType[]
  ).flatMap((type) => {
    const s = near[type];
    if (!s) return [];
    return [
      {
        type,
        label: schoolTypeLabel[type],
        name: s.name,
        km: s.km,
        within:
          ctx.schoolMatters && ctx.schoolMaxKm !== null
            ? s.km <= ctx.schoolMaxKm
            : null,
      },
    ];
  });
  const hasSchoolData = schools.length > 0;
  const maxKm = ctx.schoolMaxKm;
  const within = (types: SchoolType[]) =>
    hasSchoolData && maxKm !== null
      ? schools.some((s) => types.includes(s.type) && s.km <= maxKm)
      : null;

  const st = nearestStation(township.pos);

  const waitYears = Math.max(unit.completion - ctx.year, 0);
  const typeAvg = typeAveragePsf(unit.type);

  return {
    unit,
    township,
    availability,
    region,
    soldOut: availability.left === 0,
    priceRM,
    psf,
    loanRM,
    tenureYears: tenure,
    instalmentRM,
    downPaymentRM,
    stampDutyRM,
    loanStampRM,
    spaLegalRM,
    loanLegalRM,
    upfrontRM,
    savingsGapRM,
    firstHomeExemptionMayApply,
    maintenanceRM: maint.rm,
    maintenanceSource: maint.source,
    maintenanceNote: maint.note,
    totalMonthlyRM,
    leftRM,
    dsrAfter,
    fit: fitOf(priceRM, m.maxPriceRM),
    you,
    partner,
    bedsShort,
    bedsSpare,
    schools,
    primaryWithin: within(PRIMARY),
    secondaryWithin: within(["secondary"]),
    stationKm: st.km,
    stationName: st.station.name,
    waitYears,
    waitConflict: ctx.underConstructionOk === false && waitYears > 0,
    facilities: township.facilities?.length
      ? township.facilities
      : unit.highlights,
    typeAvgPsf: typeAvg.avg,
    typeCount: typeAvg.count,
    psfVsType: typeAvg.avg > 0 ? (psf - typeAvg.avg) / typeAvg.avg : 0,
  };
}

/* ---------------------------------------------------------------- scores */

export type StatKey =
  "monthly" | "cash" | "commute" | "space" | "family" | "value" | "ready";

export const STATS: { key: StatKey; label: string; hint: string }[] = [
  {
    key: "monthly",
    label: "Monthly",
    hint: "Money left each month after instalment, maintenance and commute",
  },
  {
    key: "cash",
    label: "Cash upfront",
    hint: "Down payment and fees against your savings",
  },
  {
    key: "commute",
    label: "Commute",
    hint: "Hours a year getting to work (and your partner's)",
  },
  {
    key: "space",
    label: "Space",
    hint: "Bedrooms against what you need, floor area, landed or high-rise",
  },
  {
    key: "family",
    label: "Family",
    hint: "Schools within your distance, parents, pets, room to grow",
  },
  {
    key: "value",
    label: "Value",
    hint: "Price per sq ft against homes of the same type",
  },
  {
    key: "ready",
    label: "Ready",
    hint: "Years until the keys, against what you said is OK",
  },
];

export type Stats = Record<StatKey, number>;

/** How the commute score treats hours a year: 100 at 100 h or less, 0 at 600 h. */
export const commuteScore = (hoursPerYear: number) =>
  clamp(100 - Math.max(hoursPerYear - 100, 0) / 5);

export function statsOf(a: HomeAnalysis, ctx: BattleContext): Stats {
  const m = ctx.money;

  // Monthly: share of take-home left after debts and the full monthly cost; capped when over budget.
  const leftShare = m.netRM > 0 && a.leftRM !== null ? a.leftRM / m.netRM : 0;
  let monthly = clamp(leftShare * 200);
  if (a.fit === "over") monthly = Math.min(monthly, 20);
  else if (a.fit === "stretch") monthly = Math.min(monthly, 45);

  // Cash: savings cover the upfront cash (100 at 118%). Unknown savings: not judged (see unjudged()).
  const cash =
    m.savingsRM !== null
      ? clamp((m.savingsRM / Math.max(a.upfrontRM, 1)) * 85)
      : 0;

  // Commute: 0 when it cannot be compared; partner counts a third.
  const commute = !a.you.compared
    ? 0
    : a.partner && a.partner.compared
      ? clamp(
          (2 * commuteScore(a.you.hoursPerYear) +
            commuteScore(a.partner.hoursPerYear)) /
            3,
        )
      : commuteScore(a.you.hoursPerYear);

  // Space: 55 if the bedrooms fit, -30 per missing bedroom, up to +30 for floor area, +/- home type.
  const typeFit =
    ctx.homeType === "either"
      ? 0
      : (ctx.homeType === "landed") === a.unit.landed
        ? 15
        : -20;
  const space = clamp(
    55 - 30 * a.bedsShort + Math.min(a.unit.builtUpSqft / 100, 30) + typeFit,
  );

  // Family: schools when they matter, parents (stairs vs lifts), pets (strata rules), a spare room.
  let family = 50;
  if (ctx.schoolMatters || ctx.hasKids) {
    if (a.primaryWithin !== null) {
      const hits = Number(a.primaryWithin) + Number(a.secondaryWithin);
      family += hits === 0 ? -15 : hits * 20;
    }
  } else if (a.schools.some((s) => s.type.endsWith("primary") && s.km <= 3))
    family += 10;
  if (ctx.parentsMovingIn) family += a.unit.landed ? -5 : 15;
  if (ctx.pets === true) family += a.unit.landed ? 15 : -10;
  if (a.bedsSpare > 0) family += 10;
  if (a.bedsShort > 0) family -= 15;
  family = clamp(family);

  // Value: 50 at the type average; every 1% cheaper adds 1.5 points.
  const value = Math.max(clamp(50 - 150 * a.psfVsType), 5);

  // Ready: keys now is 100, each year of waiting -25; capped at 15 if the buyer said no to waiting.
  let ready = clamp(100 - a.waitYears * 25);
  if (a.waitConflict) ready = Math.min(ready, 15);

  return { monthly, cash, commute, space, family, value, ready };
}

/* ---------------------------------------------------------------- weights */

export type Weights = Record<StatKey, number>;

export type PresetId = "mochi" | "monthly" | "commute" | "family" | "value";

export const PRESETS: Record<
  Exclude<PresetId, "mochi">,
  { label: string; blurb: string; weights: Weights }
> = {
  monthly: {
    label: "Lowest monthly cost",
    blurb: "What you pay every month counts most, then cash upfront.",
    weights: {
      monthly: 10,
      cash: 5,
      commute: 3,
      space: 2,
      family: 2,
      value: 3,
      ready: 1,
    },
  },
  commute: {
    label: "Shortest commute",
    blurb: "Hours on the road or train count most.",
    weights: {
      monthly: 4,
      cash: 2,
      commute: 10,
      space: 2,
      family: 2,
      value: 2,
      ready: 1,
    },
  },
  family: {
    label: "Most space / family",
    blurb: "Bedrooms, floor area and schools count most.",
    weights: {
      monthly: 4,
      cash: 2,
      commute: 3,
      space: 10,
      family: 8,
      value: 2,
      ready: 1,
    },
  },
  value: {
    label: "Best value",
    blurb: "Price per sq ft against similar homes counts most.",
    weights: {
      monthly: 5,
      cash: 4,
      commute: 2,
      space: 3,
      family: 1,
      value: 10,
      ready: 1,
    },
  },
};

/** Mochi's mix: weights read off the profile, so the default verdict fits this buyer. */
export function mochiWeights(
  ctx: BattleContext,
  sample: HomeAnalysis | null,
): { weights: Weights; why: string[] } {
  const w: Weights = {
    monthly: 6,
    cash: 4,
    commute: 5,
    space: 5,
    family: 3,
    value: 3,
    ready: 2,
  };
  const why: string[] = [];
  if (ctx.officeDays !== null && ctx.officeDays >= 4) {
    w.commute = 8;
    why.push(`${ctx.officeDays} office days`);
  } else if (ctx.officeDays !== null && ctx.officeDays <= 2) {
    w.commute = 3;
    why.push(
      `only ${ctx.officeDays} office day${ctx.officeDays === 1 ? "" : "s"}`,
    );
  }
  if (ctx.hasKids || ctx.schoolMatters) {
    w.family = ctx.schoolMatters ? 8 : 6;
    w.space = 7;
    why.push(ctx.schoolMatters ? "school distance matters" : "kids");
  }
  if (ctx.parentsMovingIn) {
    w.space = Math.max(w.space, 7);
    w.family = Math.max(w.family, 6);
    why.push("parents moving in");
  }
  if (sample && sample.dsrAfter !== null && sample.dsrAfter > 0.55) {
    w.monthly = 9;
    why.push("a tight monthly budget");
  }
  if (
    ctx.money.savingsRM !== null &&
    sample &&
    sample.savingsGapRM !== null &&
    sample.savingsGapRM < 0
  ) {
    w.cash = 7;
    why.push("savings short of the upfront cash");
  }
  if (ctx.underConstructionOk === false) {
    w.ready = 7;
    why.push("you want a ready home");
  }
  return { weights: w, why };
}

/**
 * Categories the fight can't judge for this buyer, with the reason. Nothing is guessed: no salary
 * means no monthly verdict, no savings means no cash-upfront verdict, no workplace means no commute.
 */
export function unjudged(ctx: BattleContext): Partial<Record<StatKey, string>> {
  const out: Partial<Record<StatKey, string>> = {};
  if (ctx.money.source === "missing")
    out.monthly =
      "Mochi doesn't know your salary yet, so money left each month can't be judged";
  if (ctx.money.savingsRM === null)
    out.cash =
      "Mochi doesn't know your savings, so cash upfront can't be judged";
  if (ctx.commuteMissing) out.commute = ctx.commuteMissing;
  return out;
}

/** The weights the fight really uses: categories we can't judge count zero. */
export function effectiveWeights(w: Weights, ctx: BattleContext): Weights {
  const skip = unjudged(ctx);
  return Object.fromEntries(
    STATS.map((s) => [s.key, skip[s.key] ? 0 : w[s.key]]),
  ) as Weights;
}

/** Weighted score before rounding (0-100), so rankings don't tie on rounding. */
export function rawScore(stats: Stats, w: Weights) {
  const total = STATS.reduce((sum, s) => sum + w[s.key], 0);
  if (total <= 0) return 0;
  return STATS.reduce((sum, s) => sum + stats[s.key] * w[s.key], 0) / total;
}

export function overallScore(stats: Stats, w: Weights) {
  const total = STATS.reduce((sum, s) => sum + w[s.key], 0);
  if (total <= 0) return 0;
  return clamp(
    STATS.reduce((sum, s) => sum + stats[s.key] * w[s.key], 0) / total,
  );
}

/* ---------------------------------------------------------------- table helpers */

/** Indices of the best value in a row (nulls skipped), or none when everyone ties. */
export function bestIndices(
  values: (number | null)[],
  better: "high" | "low",
): Set<number> {
  const real = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (real.length < 2) return new Set();
  const target = better === "high" ? Math.max(...real) : Math.min(...real);
  const idx = values.flatMap((v, i) =>
    v !== null && Math.abs(v - target) < 1e-9 ? [i] : [],
  );
  return idx.length === real.length ? new Set() : new Set(idx);
}

/** How far the best value beats the next best in a row (absolute), or null. */
export function leadOverNext(
  values: (number | null)[],
  better: "high" | "low",
): number | null {
  const real = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (real.length < 2) return null;
  const sorted = [...real].sort((a, b) => (better === "high" ? b - a : a - b));
  const gap = Math.abs(sorted[0]! - sorted[1]!);
  return gap > 1e-9 ? gap : null;
}
