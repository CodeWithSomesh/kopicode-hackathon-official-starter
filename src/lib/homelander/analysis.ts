import {
  affordability,
  anchorOptions,
  availabilityOf,
  costOfUnit,
  driveMinutes,
  rm,
  samplePayslip,
  townshipById,
  transitMinutes,
  units as allUnits,
  type Availability,
  type Township,
  type Unit,
} from "./data";
import type { HomeLanderState } from "./store";

/**
 * Head-to-head analysis for the Compare ("Battle") screen.
 * Every figure is an estimate on SAMPLE units, not a loan offer.
 *
 * Each unit gets six 0-100 stats (higher is always better for the buyer, except Scarcity,
 * which is "how rare": fewer units left scores higher). The overall score is a weighted
 * average of the stats; the weights come from a preset or the buyer's sliders.
 */

export type StatKey = "commute" | "space" | "wallet" | "value" | "ready" | "scarcity";

export const STATS: { key: StatKey; label: string; hint: string }[] = [
  { key: "commute", label: "Commute", hint: "Hours on the road each week, both ways" },
  { key: "space", label: "Space", hint: "Bedrooms against what you need, plus floor area" },
  { key: "wallet", label: "Wallet", hint: "Money left each month after the instalment" },
  { key: "value", label: "Value", hint: "Price per sqft against the median of every Gamuda Land unit listed" },
  { key: "ready", label: "Ready-in", hint: "How soon you get the keys" },
  { key: "scarcity", label: "Scarcity", hint: "How few units are left. Rare, so decide faster" },
];

export type Weights = Record<StatKey, number>;

export type PresetId = "time" | "space" | "budget";

export const PRESETS: Record<PresetId, { label: string; blurb: string; weights: Weights }> = {
  time: {
    label: "Save time",
    blurb: "Commute counts most",
    weights: { commute: 8, space: 3, wallet: 4, value: 2, ready: 2, scarcity: 1 },
  },
  space: {
    label: "Max space",
    blurb: "Room to grow counts most",
    weights: { commute: 3, space: 8, wallet: 4, value: 2, ready: 2, scarcity: 1 },
  },
  budget: {
    label: "Tight budget",
    blurb: "Money left over counts most",
    weights: { commute: 3, space: 2, wallet: 8, value: 5, ready: 1, scarcity: 1 },
  },
};

/* ---------------------------------------------------------------- context */

export type MoneyContext = {
  source: "bank" | "sample";
  netRM: number;
  commitmentsRM: number;
  maxPriceRM: number;
};

export type AnalysisContext = {
  anchorId: string;
  anchorName: string;
  officeDays: number;
  /** The way the buyer said they travel; null means "use the faster of car and train". */
  mode: "car" | "train" | null;
  bedsNeeded: number;
  wantsLanded: boolean;
  money: MoneyContext;
  year: number;
};

/** Builds the context from the store: bank check if run, else the sample payslip; answers if given, else defaults. */
export function analysisContext(
  s: Pick<HomeLanderState, "anchorId" | "answers" | "budget">,
  opts: { officeDays?: number; year?: number } = {},
): AnalysisContext {
  const anchor = anchorOptions.find((a) => a.id === s.anchorId) ?? anchorOptions[0]!;
  const a = s.answers;
  const sample = affordability(samplePayslip);
  const money: MoneyContext = s.budget
    ? {
        source: "bank",
        netRM: s.budget.netRM,
        commitmentsRM: s.budget.commitmentsRM,
        maxPriceRM: s.budget.maxPriceRM,
      }
    : { source: "sample", netRM: sample.netRM, commitmentsRM: sample.commitmentsRM, maxPriceRM: sample.maxPriceRM };
  return {
    anchorId: anchor.id,
    anchorName: anchor.name,
    officeDays: opts.officeDays ?? a?.officeDays ?? 5,
    mode: a?.mode ?? null,
    bedsNeeded: 2 + (a?.kids === "yes" ? 1 : 0) + (a?.parents === "yes" ? 1 : 0),
    wantsLanded: a?.kids === "yes" || a?.parents === "yes",
    money,
    year: opts.year ?? new Date().getFullYear(),
  };
}

/* ---------------------------------------------------------------- per unit */

export type UnitAnalysis = {
  unit: Unit;
  township: Township;
  availability: Availability;
  priceRM: number;
  psf: number;
  /** Positive: cheaper per sqft than the median. As a fraction, e.g. 0.12 = 12% cheaper. */
  psfVsMedian: number;
  instalmentRM: number;
  upfrontRM: number;
  leftoverRM: number;
  overBudget: boolean;
  driveOneWay: number;
  trainOneWay: number;
  station: string;
  stationKm: number;
  line: string;
  driveWeekHours: number;
  trainWeekHours: number;
  /** The mode used for the Commute stat. */
  usedMode: "car" | "train";
  weekHours: number;
  bedsShort: number;
  waitYears: number;
  stats: Record<StatKey, number>;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** RM per sqft median across every unit in the catalogue, so Value does not shift when you swap fighters. */
export const MEDIAN_PSF = median(allUnits.map((u) => u.priceRM / u.builtUpSqft));

export function analyseUnit(unit: Unit, ctx: AnalysisContext): UnitAnalysis {
  const township = townshipById[unit.townshipId]!;
  const anchor = anchorOptions.find((a) => a.id === ctx.anchorId) ?? anchorOptions[0]!;
  const availability = availabilityOf(unit.id);

  const psf = unit.priceRM / unit.builtUpSqft;
  const psfVsMedian = (MEDIAN_PSF - psf) / MEDIAN_PSF;

  const cost = costOfUnit(unit.priceRM, ctx.money.netRM, ctx.money.commitmentsRM);
  const overBudget = unit.priceRM > ctx.money.maxPriceRM;

  const driveOneWay = driveMinutes(township.pos, anchor.pos);
  const train = transitMinutes(township.pos, anchor.pos);
  const perWeek = (oneWay: number) => (oneWay * 2 * ctx.officeDays) / 60;
  const driveWeekHours = perWeek(driveOneWay);
  const trainWeekHours = perWeek(train.minutes);
  const usedMode = ctx.mode ?? (train.minutes < driveOneWay ? "train" : "car");
  const weekHours = usedMode === "train" ? trainWeekHours : driveWeekHours;

  const bedsShort = Math.max(ctx.bedsNeeded - unit.beds, 0);
  const waitYears = Math.max(unit.completion - ctx.year, 0);

  // Commute: 2 h a week or less is full HP; every extra hour costs 6 points.
  const commute = clamp(100 - Math.max(weekHours - 2, 0) * 6);
  // Space: 65 if the bedrooms fit (minus 30 per missing bedroom), up to +30 for floor area, +5 landed when family needs it.
  const space = clamp(
    65 - 30 * bedsShort + Math.min(unit.builtUpSqft / 110, 30) + (ctx.wantsLanded && unit.landed ? 5 : 0),
  );
  // Wallet: share of take-home pay left after commitments and the instalment; capped low when over budget.
  const leftShare = cost.leftover / ctx.money.netRM;
  const wallet = overBudget ? Math.min(clamp(leftShare * 160), 20) : clamp(leftShare * 160);
  // Value: 50 at the median RM/sqft, log-scaled so city condos do not all flatline; floor of 5.
  const value = Math.max(clamp(50 + 75 * Math.log(MEDIAN_PSF / psf)), 5);
  // Ready-in: keys this year is 100; each year of waiting costs 25.
  const ready = clamp(100 - waitYears * 25);
  // Scarcity: fewer units left is rarer. Sold out is 0 (you cannot buy it).
  const scarcity = availability.left === 0 ? 0 : clamp(100 - (availability.left - 1) * 3);

  return {
    unit,
    township,
    availability,
    priceRM: unit.priceRM,
    psf,
    psfVsMedian,
    instalmentRM: cost.instalment,
    upfrontRM: cost.upfront,
    leftoverRM: cost.leftover,
    overBudget,
    driveOneWay,
    trainOneWay: train.minutes,
    station: train.station,
    stationKm: train.stationKm,
    line: train.line,
    driveWeekHours,
    trainWeekHours,
    usedMode,
    weekHours,
    bedsShort,
    waitYears,
    stats: { commute, space, wallet, value, ready, scarcity },
  };
}

/* ---------------------------------------------------------------- the battle */

export type Fighter = UnitAnalysis & { overall: number; rank: number };

export type Battle = {
  /** In lineup order. */
  fighters: Fighter[];
  winner: Fighter;
  runnerUp: Fighter | null;
  reasons: string[];
  caveats: string[];
  closeCall: boolean;
};

export function overallScore(stats: Record<StatKey, number>, w: Weights) {
  const total = STATS.reduce((sum, s) => sum + w[s.key], 0);
  if (total <= 0) return 0;
  return clamp(STATS.reduce((sum, s) => sum + stats[s.key] * w[s.key], 0) / total);
}

export function battle(list: Unit[], ctx: AnalysisContext, weights: Weights): Battle {
  const analysed = list.map((u) => analyseUnit(u, ctx));
  const scored = analysed.map((a) => ({ ...a, overall: overallScore(a.stats, weights), rank: 0 }));
  // Sold-out homes cannot win while anything else is still for sale.
  const order = [...scored].sort(
    (a, b) => Number(a.availability.left === 0) - Number(b.availability.left === 0) || b.overall - a.overall,
  );
  order.forEach((f, i) => (f.rank = i + 1));
  const winner = order[0]!;
  const runnerUp = order[1] ?? null;
  return {
    fighters: scored,
    winner,
    runnerUp,
    reasons: battleReasons(winner, runnerUp, weights, ctx),
    caveats: battleCaveats(winner, runnerUp, ctx),
    closeCall: runnerUp ? winner.overall - runnerUp.overall < 3 : false,
  };
}

const hrs = (h: number) => `${h.toFixed(1)} h`;
const year = (n: number) => (n === 1 ? "1 year" : `${n} years`);

/** 2-4 plain reasons the winner beats the runner-up, strongest (by weight x gap) first. */
export function battleReasons(best: Fighter, next: Fighter | null, w: Weights, ctx: AnalysisContext): string[] {
  if (!next) return [`${best.unit.name} is the only fighter in the ring.`];
  const cands: { score: number; text: string }[] = [];
  const gap = (k: StatKey) => (best.stats[k] - next.stats[k]) * w[k];

  const dh = next.weekHours - best.weekHours;
  if (dh >= 0.5)
    cands.push({
      score: gap("commute"),
      text: `It gives you back ${hrs(dh)} a week on the ${best.usedMode === "train" ? "train" : "road"} compared with ${next.unit.name}.`,
    });

  if (next.overBudget && !best.overBudget)
    cands.push({
      score: gap("wallet") + 200,
      text: `${next.unit.name} is above the ${rm(ctx.money.maxPriceRM)} the bank is likely to lend against; this one is not.`,
    });
  else if (best.leftoverRM - next.leftoverRM > 150)
    cands.push({
      score: gap("wallet"),
      text: `You keep about ${rm(best.leftoverRM - next.leftoverRM)} more each month after the instalment.`,
    });

  if (next.bedsShort > best.bedsShort)
    cands.push({
      score: gap("space") + 100,
      text: `${next.unit.name} has ${next.unit.beds} bedroom${next.unit.beds === 1 ? "" : "s"}; you need ${ctx.bedsNeeded}.`,
    });
  else if (best.unit.builtUpSqft - next.unit.builtUpSqft >= 200)
    cands.push({
      score: gap("space"),
      text: `${(best.unit.builtUpSqft - next.unit.builtUpSqft).toLocaleString("en-MY")} sqft more room to move.`,
    });

  if (next.psf - best.psf >= 20)
    cands.push({
      score: gap("value"),
      text: `Better value: about RM${Math.round(next.psf - best.psf)} less per sqft.`,
    });

  if (next.waitYears > best.waitYears)
    cands.push({
      score: gap("ready"),
      text:
        best.waitYears === 0
          ? `Keys in ${best.unit.completion}, so no years of paying rent and instalment at the same time.`
          : `You get the keys ${year(next.waitYears - best.waitYears)} sooner (${best.unit.completion} vs ${next.unit.completion}).`,
    });

  if (best.unit.tenure === "Freehold" && next.unit.tenure === "Leasehold")
    cands.push({ score: 15, text: `Freehold, so no lease running down on you. ${next.unit.name} is leasehold.` });

  const out = cands
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((c) => c.text);
  if (out.length < 2) out.push(`On the weights you set, it edges ${next.unit.name} overall (${best.overall} vs ${next.overall}).`);
  return out;
}

/** Honest warnings about the winner, including where the runner-up beats it. */
export function battleCaveats(best: Fighter, next: Fighter | null, ctx: AnalysisContext): string[] {
  const out: string[] = [];
  if (best.availability.left === 0) out.push("Every fighter left is sold out. Ask the sales gallery about the next phase.");
  if (best.overBudget)
    out.push(
      `At ${rm(best.priceRM)} it is above the roughly ${rm(ctx.money.maxPriceRM)} the bank is likely to lend against.`,
    );
  else if (best.leftoverRM < ctx.money.netRM * 0.2)
    out.push(`Tight: only ${rm(best.leftoverRM)} left each month once the instalment and your other loans are paid.`);
  if (best.bedsShort > 0) out.push(`It has ${best.unit.beds} bedrooms and you said you need ${ctx.bedsNeeded}.`);
  if (best.availability.left > 0 && best.availability.left <= 7)
    out.push(`Only ${best.availability.left} left in ${best.availability.phase}. If you like it, do not sleep on it.`);
  if (best.waitYears >= 2) out.push(`Keys in ${best.unit.completion}: ${year(best.waitYears)} of waiting, maybe while paying rent.`);
  if (best.unit.tenure === "Leasehold") out.push("Leasehold: check how many years are left on the lease.");
  if (best.weekHours > 10) out.push(`${hrs(best.weekHours)} a week commuting is a lot. Try a closer work anchor or the train.`);

  if (next) {
    const losses = STATS.filter((s) => s.key !== "scarcity")
      .map((s) => ({ s, d: next.stats[s.key] - best.stats[s.key] }))
      .filter((x) => x.d >= 15)
      .sort((a, b) => b.d - a.d);
    const top = losses[0];
    if (top) out.push(`${next.unit.name} still beats it on ${top.s.label.toLowerCase()} (${next.stats[top.s.key]} vs ${best.stats[top.s.key]}).`);
  }
  if (ctx.money.source === "sample")
    out.push("Money uses a sample payslip. Run the bank check to use yours.");
  return out.slice(0, 4);
}

/** Which cells are best in a row: indices of the best value, or none when everyone ties. */
export function bestIndices(values: number[], better: "high" | "low"): Set<number> {
  if (values.length < 2) return new Set();
  const target = better === "high" ? Math.max(...values) : Math.min(...values);
  const idx = values.flatMap((v, i) => (Math.abs(v - target) < 1e-9 ? [i] : []));
  return idx.length === values.length ? new Set() : new Set(idx);
}

/** Lineup to open with: saved Compare picks, else the first 3 liked, else the sample lineup. */
export type LineupSource = "picks" | "liked" | "mixed" | "sample";

export const SAMPLE_LINEUP = ["gardens-t1", "highpark-c", "jade-t1"];

export function startingLineup(
  s: Pick<HomeLanderState, "compare" | "liked">,
  isUnit: (id: string) => boolean,
): { ids: string[]; source: LineupSource } {
  const picks = s.compare.filter(isUnit);
  if (picks.length >= 2) return { ids: picks.slice(0, 3), source: "picks" };
  const liked = s.liked.filter(isUnit).slice(0, 3);
  if (liked.length >= 2) return { ids: liked, source: "liked" };
  if (liked.length === 1) {
    const pad = SAMPLE_LINEUP.filter((id) => id !== liked[0]).slice(0, 2);
    return { ids: [liked[0]!, ...pad], source: "mixed" };
  }
  return { ids: SAMPLE_LINEUP, source: "sample" };
}
