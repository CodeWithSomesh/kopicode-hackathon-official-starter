import {
  analyseHome,
  overallScore,
  statsOf,
  STATS,
  type HomeAnalysis,
  type StatKey,
  type Stats,
  type Weights,
} from "./analysis";
import type { BattleContext } from "./battle-context";
import { rm, type Unit } from "./data";
import { translate, type TFn } from "./i18n/translate";

/**
 * The fight itself: score every home, pick a winner, and explain it in numbers a buyer can
 * check against the table. Sold-out homes cannot win while anything else is for sale.
 */

export type Fighter = HomeAnalysis & {
  stats: Stats;
  /** Weighted score minus profile penalties, 0-100. */
  overall: number;
  /** Points taken off for deal-breakers hit and must-haves missing (known fails only). */
  penalty: number;
  rank: number;
  /** Swipe-deck match score (recommend.ts), 0-100. */
  match: number;
};

export type RivalLine = {
  id: string;
  name: string;
  monthlyRM: number;
  hoursPerYear: number | null;
  upfrontRM: number;
  overall: number;
};

export type Battle = {
  fighters: Fighter[];
  winner: Fighter;
  runnerUp: Fighter | null;
  reasons: string[];
  caveats: string[];
  closeCall: boolean;
  /** Winner vs every other fighter: positive numbers favour the winner. */
  rivals: RivalLine[];
  checks: Check[];
};

/* ---------------------------------------------------------------- formatting */

const k = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `RM${(n / 1_000_000).toFixed(2)}M`
    : `RM${Math.round(n / 1000)}k`;
const money = (n: number) => rm(Math.round(n));
const pct = (f: number) => `${Math.round(Math.abs(f) * 100)}%`;
/** English by default: callers in a component pass their own `t` (useT) so the sentences follow the language switch. */
const en: TFn = (s, v) => translate("en", s, v);
const plural = (tr: TFn, n: number, w: "bedroom" | "year") =>
  tr(w === "bedroom" ? (n === 1 ? "{n} bedroom" : "{n} bedrooms") : n === 1 ? "{n} year" : "{n} years", { n });
const byMode = (tr: TFn, mode: string) => (mode === "train" ? tr("by train") : tr("by car"));
const relTo = (tr: TFn, f: number) => (f <= 0 ? tr("under") : tr("over"));
const typeWord = (u: Unit) =>
  u.type === "Serviced apartment" ? "serviced apartment" : u.type.toLowerCase();

/* ---------------------------------------------------------------- battle */

/** A home that hits a deal-breaker loses 15 points; one missing a must-have loses 8. */
export const DEAL_BREAKER_PENALTY = 15;
export const MUST_HAVE_PENALTY = 8;

export function runBattle(
  list: Unit[],
  ctx: BattleContext,
  weights: Weights,
  matchOf: (u: Unit) => number,
  tr: TFn = en,
): Battle | null {
  if (list.length === 0) return null;
  const analysed = list.map((u) => analyseHome(u, ctx));
  const checks = profileChecks(analysed, ctx, tr);
  const fighters: Fighter[] = analysed.map((a) => {
    const stats = statsOf(a, ctx);
    const penalty = checks.reduce(
      (sum, c) =>
        sum +
        (c.results[a.unit.id]?.ok === "no"
          ? c.kind === "never"
            ? DEAL_BREAKER_PENALTY
            : MUST_HAVE_PENALTY
          : 0),
      0,
    );
    return {
      ...a,
      stats,
      overall: Math.max(overallScore(stats, weights) - penalty, 0),
      penalty,
      rank: 0,
      match: matchOf(a.unit),
    };
  });
  const order = [...fighters].sort(
    (a, b) =>
      Number(a.soldOut) - Number(b.soldOut) ||
      b.overall - a.overall ||
      b.match - a.match,
  );
  order.forEach((f, i) => (f.rank = i + 1));
  const winner = order[0]!;
  const runnerUp = order[1] ?? null;
  return {
    fighters,
    winner,
    runnerUp,
    reasons: reasonsFor(winner, runnerUp, weights, ctx, fighters, checks, tr),
    caveats: caveatsFor(winner, runnerUp, ctx, checks, tr),
    closeCall: runnerUp ? winner.overall - runnerUp.overall < 3 : false,
    rivals: order.slice(1).map((r) => ({
      id: r.unit.id,
      name: r.unit.name,
      monthlyRM: r.totalMonthlyRM - winner.totalMonthlyRM,
      hoursPerYear:
        r.you.compared && winner.you.compared
          ? r.you.hoursPerYear - winner.you.hoursPerYear
          : null,
      upfrontRM: r.upfrontRM - winner.upfrontRM,
      overall: winner.overall - r.overall,
    })),
    checks,
  };
}

/* ---------------------------------------------------------------- reasons */

/** 3-5 concrete reasons the winner beats the runner-up, biggest (weight x score gap) first. */
export function reasonsFor(
  best: Fighter,
  next: Fighter | null,
  w: Weights,
  ctx: BattleContext,
  field: Fighter[] = [],
  checks: Check[] = [],
  tr: TFn = en,
): string[] {
  if (!next)
    return [tr("{name} is the only home in the ring. Add another to compare.", { name: best.unit.name })];
  const out: { score: number; text: string; keys: StatKey[] }[] = [];
  const gap = (key: StatKey) => (best.stats[key] - next.stats[key]) * w[key];
  const vs = next.unit.name;
  const by = byMode(tr, best.you.mode);

  const dMonth = next.totalMonthlyRM - best.totalMonthlyRM;
  const bothCommute = best.you.compared && next.you.compared;
  const dHours = bothCommute
    ? next.you.hoursPerYear - best.you.hoursPerYear
    : 0;
  if (dMonth >= 50 && dHours >= 20) {
    out.push({
      keys: ["monthly", "commute"],
      score: gap("monthly") + gap("commute") + 50,
      text: tr("Saves about {amount} a month and {hours} hours a year of commuting vs {vs} ({a} vs {b} min one way {by}).", { amount: money(dMonth), hours: dHours, vs, a: best.you.oneWayMin, b: next.you.oneWayMin, by }),
    });
  } else {
    if (dMonth >= 50) {
      const dInst = next.instalmentRM - best.instalmentRM;
      const dComm = next.you.monthlyRM - best.you.monthlyRM;
      const parts = [
        Math.abs(dInst) >= 20
          ? tr("instalment {sign}{amount}", { sign: dInst > 0 ? "-" : "+", amount: money(Math.abs(dInst)) })
          : null,
        bothCommute && Math.abs(dComm) >= 20
          ? tr("commute {sign}{amount}", { sign: dComm > 0 ? "-" : "+", amount: money(Math.abs(dComm)) })
          : null,
      ].filter(Boolean);
      out.push({
        keys: ["monthly"],
        score: gap("monthly") + 20,
        text: tr("About {amount} a month cheaper to live in than {vs}{parts}.", { amount: money(dMonth), vs, parts: parts.length ? ` (${parts.join(", ")})` : "" }),
      });
    }
    if (dHours >= 20)
      out.push({
        keys: ["commute"],
        score: gap("commute") + 10,
        text: tr("{hours} fewer hours a year getting to {work} than from {vs} ({a} vs {b} min one way {by}).", { hours: dHours, work: ctx.work.name, vs, a: best.you.oneWayMin, b: next.you.oneWayMin, by }),
      });
  }
  if (best.you.compared && !next.you.compared)
    out.push({
      keys: ["commute"],
      score: 300,
      text: tr("You can commute to {work} from here. {vs} is not a daily commute.", { work: ctx.work.name, vs }),
    });

  if (best.partner?.compared && next.partner?.compared) {
    const dp = next.partner.hoursPerYear - best.partner.hoursPerYear;
    if (dp >= 30)
      out.push({
        keys: ["commute"],
        score: gap("commute") / 2,
        text: tr("Your partner gets back {n} hours a year too, going to {place}.", { n: dp, place: best.partner.anchor.name }),
      });
  }

  if (next.fit !== "in" && best.fit === "in")
    out.push({
      keys: ["monthly"],
      score: gap("monthly") + 200,
      text:
        next.fit === "over"
          ? tr("{vs} is over the roughly {max} the bank may lend against ({price}); this one fits at {mine}.", { vs, max: k(ctx.money.maxPriceRM), price: k(next.priceRM), mine: k(best.priceRM) })
          : tr("{vs} is a stretch on the roughly {max} the bank may lend against ({price}); this one fits at {mine}.", { vs, max: k(ctx.money.maxPriceRM), price: k(next.priceRM), mine: k(best.priceRM) }),
    });

  const dUp = next.upfrontRM - best.upfrontRM;
  if (dUp >= 5_000) {
    const sav = ctx.money.savingsRM;
    const tail =
      sav === null
        ? ""
        : best.savingsGapRM !== null &&
            best.savingsGapRM >= 0 &&
            next.savingsGapRM !== null &&
            next.savingsGapRM < 0
          ? tr(": your {sav} savings cover it, but not {vs}", { sav: k(sav), vs })
          : "";
    out.push({
      keys: ["cash"],
      score: gap("cash") + (tail ? 80 : 10),
      text: tr("Needs {d} less cash upfront ({a} vs {b}){tail}.", { d: k(dUp), a: k(best.upfrontRM), b: k(next.upfrontRM), tail }),
    });
  }

  if (next.bedsShort > best.bedsShort)
    out.push({
      keys: ["space"],
      score: gap("space") + 100,
      text: tr("{beds} for the {need} you need; {vs} has {n}.", { beds: plural(tr, best.unit.beds, "bedroom"), need: ctx.bedsNeeded, vs, n: next.unit.beds }),
    });
  else if (best.unit.builtUpSqft - next.unit.builtUpSqft >= 200)
    out.push({
      keys: ["space"],
      score: gap("space"),
      text: tr("{diff} sq ft more floor space ({a} vs {b}).", { diff: (best.unit.builtUpSqft - next.unit.builtUpSqft).toLocaleString("en-MY"), a: best.unit.builtUpSqft.toLocaleString("en-MY"), b: next.unit.builtUpSqft.toLocaleString("en-MY") }),
    });

  if (next.psfVsType - best.psfVsType >= 0.05)
    out.push({
      keys: ["value"],
      score: gap("value"),
      text: tr("Better value: RM{psf} psf is {pct} {rel} the average {type}; {vs} is {pct2} {rel2} its type.", { psf: Math.round(best.psf), pct: pct(best.psfVsType), rel: relTo(tr, best.psfVsType), type: typeWord(best.unit), vs, pct2: pct(next.psfVsType), rel2: relTo(tr, next.psfVsType) }),
    });

  if (
    (ctx.schoolMatters || ctx.hasKids) &&
    best.primaryWithin &&
    next.primaryWithin === false
  ) {
    const s = best.schools
      .filter((x) => x.type.endsWith("primary"))
      .sort((a, b) => a.km - b.km)[0];
    out.push({
      keys: ["family"],
      score: gap("family") + 60,
      text: tr("A primary school within your {km} km{school}; {vs} has none that close.", { km: ctx.schoolMaxKm, school: s ? ` (${s.name}, ${s.km.toFixed(1)} km)` : "", vs }),
    });
  }

  if (next.waitYears > best.waitYears)
    out.push({
      keys: ["ready"],
      score: gap("ready") + (next.waitConflict ? 80 : 0),
      text:
        best.waitYears === 0
          ? best.unit.completion <= ctx.year
            ? tr("Keys now: no years of paying rent on top of the loan, unlike {vs} ({year}).", { vs, year: next.unit.completion })
            : tr("Keys in {y}: no years of paying rent on top of the loan, unlike {vs} ({year}).", { y: best.unit.completion, vs, year: next.unit.completion })
          : tr("Keys {years} sooner ({a} vs {b}).", { years: plural(tr, next.waitYears - best.waitYears, "year"), a: best.unit.completion, b: next.unit.completion }),
    });

  if (best.unit.tenure === "Freehold" && next.unit.tenure === "Leasehold")
    out.push({
      keys: ["value"],
      score: 15,
      text: tr("Freehold, so no lease running down. {vs} is leasehold.", { vs }),
    });

  if (next.penalty > best.penalty) {
    const hit = checks.find(
      (c) =>
        c.results[next.unit.id]?.ok === "no" &&
        c.results[best.unit.id]?.ok !== "no",
    );
    if (hit)
      out.push({
        keys: [],
        score: 250,
        text:
          hit.kind === "never"
            ? tr("{vs} hits your deal-breaker “{text}” ({why}); this one doesn't.", { vs, text: hit.text, why: hit.results[next.unit.id]!.why })
            : tr("{vs} misses your must-have “{text}” ({why}); this one doesn't.", { vs, text: hit.text, why: hit.results[next.unit.id]!.why }),
      });
  }

  const chosen = out
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const picked = chosen.map((c) => c.text);
  const covered = new Set<string>(chosen.flatMap((c) => c.keys));

  // Still short: what the winner leads the whole field on.
  const rivals = field.filter((f) => f.unit.id !== best.unit.id);
  if (picked.length < 3 && rivals.length) {
    const n = field.length;
    const facts: { key: string; ok: boolean; text: string }[] = [
      {
        key: "monthly",
        ok: rivals.every((r) => r.totalMonthlyRM > best.totalMonthlyRM),
        text: tr("Cheapest to live in of all {n}: {a} a month all-in, leaving {b}.", { n, a: money(best.totalMonthlyRM), b: money(best.leftRM) }),
      },
      {
        key: "commute",
        ok:
          best.you.compared &&
          rivals.every(
            (r) =>
              !r.you.compared || r.you.hoursPerYear > best.you.hoursPerYear,
          ),
        text: tr("Shortest commute of all {n}: {h} hours a year, {m} min each way {by}.", { n, h: best.you.hoursPerYear, m: best.you.oneWayMin, by }),
      },
      {
        key: "cash",
        ok: rivals.every((r) => r.upfrontRM > best.upfrontRM),
        text: tr("Least cash upfront of all {n}: {a}.", { n, a: k(best.upfrontRM) }),
      },
      {
        key: "space",
        ok: rivals.every((r) => r.unit.builtUpSqft < best.unit.builtUpSqft),
        text: tr("Most floor space of all {n}: {sqft} sq ft, {beds}.", { n, sqft: best.unit.builtUpSqft.toLocaleString("en-MY"), beds: plural(tr, best.unit.beds, "bedroom") }),
      },
      {
        key: "value",
        ok: rivals.every((r) => r.psfVsType > best.psfVsType),
        text: tr("Best value of all {n} against its type: RM{psf} psf, {pct} {rel} the average {type}.", { n, psf: Math.round(best.psf), pct: pct(best.psfVsType), rel: relTo(tr, best.psfVsType), type: typeWord(best.unit) }),
      },
      {
        key: "ready",
        ok: best.waitYears === 0 && rivals.some((r) => r.waitYears > 0),
        text: tr("Ready now (keys {year}), while {n} of the others are still being built.", { year: best.unit.completion, n: rivals.filter((r) => r.waitYears > 0).length }),
      },
      {
        key: "fit",
        ok: best.fit === "in" && best.dsrAfter <= 0.6,
        text: tr("Comfortably inside your budget: {a} under the bank ceiling, debt service ratio {pct} with this loan.", { a: k(ctx.money.maxPriceRM - best.priceRM), pct: pct(best.dsrAfter) }),
      },
    ];
    for (const f of facts.filter((x) => x.ok && !covered.has(x.key))) {
      if (picked.length >= 3) break;
      picked.push(f.text);
      covered.add(f.key);
    }
  }

  if (picked.length < 3) {
    const leads = STATS.map((s) => ({
      s,
      d: best.stats[s.key] - next.stats[s.key],
    }))
      .filter((x) => x.d >= 5 && !covered.has(x.s.key))
      .sort((a, b) => b.d * w[b.s.key] - a.d * w[a.s.key]);
    for (const l of leads.slice(0, 3 - picked.length))
      picked.push(
        tr("Scores higher on {label}: {a} vs {b} ({hint}).", { label: tr(l.s.label).toLowerCase(), a: best.stats[l.s.key], b: next.stats[l.s.key], hint: tr(l.s.hint).toLowerCase() }),
      );
  }
  if (picked.length < 2)
    picked.push(
      tr("On your priorities it edges {vs} overall, {a} vs {b}.", { vs, a: best.overall, b: next.overall }),
    );
  return picked;
}

/* ---------------------------------------------------------------- caveats */

export function caveatsFor(
  best: Fighter,
  next: Fighter | null,
  ctx: BattleContext,
  checks: Check[],
  tr: TFn = en,
): string[] {
  const out: string[] = [];
  const m = ctx.money;
  if (best.soldOut)
    out.push(tr("Every home in the ring is sold out. Ask the sales gallery about the next phase."));
  if (best.fit !== "in")
    out.push(
      best.fit === "over"
        ? tr("At {price} it is over the roughly {max} the bank may lend against.", { price: k(best.priceRM), max: k(m.maxPriceRM) })
        : tr("At {price} it is a stretch on the roughly {max} the bank may lend against.", { price: k(best.priceRM), max: k(m.maxPriceRM) }),
    );
  if (best.dsrAfter > 0.6)
    out.push(
      best.dsrAfter <= 0.7
        ? tr("Your debt service ratio would be {pct} with this loan: above the common 60% line, though some banks go to 70%.", { pct: pct(best.dsrAfter) })
        : tr("Your debt service ratio would be {pct} with this loan: above the common 60% line and the 70% some banks allow.", { pct: pct(best.dsrAfter) }),
    );
  if (best.savingsGapRM !== null && best.savingsGapRM < 0)
    out.push(tr("You'd be {a} short on cash upfront (needs {b}).", { a: k(-best.savingsGapRM), b: k(best.upfrontRM) }));
  if (best.leftRM < m.netRM * 0.15)
    out.push(tr("Tight: about {a} left a month once the loan, fees, commute and other debts are paid.", { a: money(best.leftRM) }));
  if (best.bedsShort > 0)
    out.push(tr("{beds}, and you said you need {need}.", { beds: plural(tr, best.unit.beds, "bedroom"), need: ctx.bedsNeeded }));
  if (best.waitConflict)
    out.push(tr("Keys only in {year}, and you said a home under construction is not OK.", { year: best.unit.completion }));
  else if (best.waitYears >= 2)
    out.push(tr("Keys in {year}: {n} of waiting, maybe while paying rent.", { year: best.unit.completion, n: plural(tr, best.waitYears, "year") }));
  if (!best.you.compared && best.you.notComparedWhy)
    out.push(best.you.notComparedWhy);
  else if (best.you.hoursPerYear > 350)
    out.push(tr("{h} hours a year commuting is a lot: about {d} working days.", { h: best.you.hoursPerYear, d: Math.round(best.you.hoursPerYear / 8) }));
  if (best.unit.tenure === "Leasehold")
    out.push(tr("Leasehold: ask how many years are left on the lease."));
  if (!best.soldOut && best.availability.left <= 7)
    out.push(tr("Only {n} left in {phase} (sample count).", { n: best.availability.left, phase: best.availability.phase }));

  for (const c of checks) {
    const r = c.results[best.unit.id];
    if (r?.ok === "no")
      out.push(
        c.kind === "must"
          ? tr("Missing your must-have “{text}”: {why}.", { text: c.text, why: r.why })
          : tr("Hits your deal-breaker “{text}”: {why}.", { text: c.text, why: r.why }),
      );
  }

  if (next) {
    const losses = STATS.map((s) => ({
      s,
      d: next.stats[s.key] - best.stats[s.key],
    }))
      .filter((x) => x.d >= 15)
      .sort((a, b) => b.d - a.d);
    const top = losses[0];
    if (top)
      out.push(tr("{vs} still beats it on {label} ({a} vs {b}).", { vs: next.unit.name, label: tr(top.s.label).toLowerCase(), a: next.stats[top.s.key], b: best.stats[top.s.key] }));
  }
  if (m.savingsRM === null)
    out.push(tr("Tell Uncle your savings and we can check the cash upfront."));
  if (m.source === "sample")
    out.push(tr("Money uses a sample payslip, not yours. Sit with Uncle or run the bank check."));
  return out.slice(0, 6);
}

/* ---------------------------------------------------------------- must-haves / deal-breakers */

export type CheckOk = "yes" | "no" | "unknown";
export type Check = {
  text: string;
  kind: "must" | "never";
  results: Record<string, { ok: CheckOk; why: string }>;
};

type Found = { met: boolean | null; why: string };

/** Does this home HAVE the thing the phrase describes? null when our data cannot tell. */
export function hasFeature(
  phrase: string,
  a: HomeAnalysis,
  ctx: BattleContext,
  tr: TFn = en,
): Found {
  const p = phrase.toLowerCase();
  const text = [
    ...a.facilities,
    ...a.unit.highlights,
    a.township.name,
    a.township.area,
  ]
    .join(" ")
    .toLowerCase();
  const has = (re: RegExp): Found => {
    const hit = text.match(re);
    return hit
      ? { met: true, why: tr("listed: “{what}”", { what: hit[0] }) }
      : { met: null, why: tr("not in our listing, ask the sales gallery") };
  };

  if (/\b(mrt|lrt|ktm|train|rail|station|transit)\b/.test(p))
    return {
      met: a.stationKm <= 1.5,
      why: tr("{km} km to {station}", { km: a.stationKm.toFixed(1), station: a.stationName }),
    };
  if (/leasehold/.test(p))
    return { met: a.unit.tenure === "Leasehold", why: a.unit.tenure };
  if (/freehold/.test(p))
    return { met: a.unit.tenure === "Freehold", why: a.unit.tenure };
  if (/(\d+)\s*(bed|room|br)/.test(p)) {
    const n = Number(p.match(/(\d+)\s*(bed|room|br)/)![1]);
    return { met: a.unit.beds >= n, why: plural(tr, a.unit.beds, "bedroom") };
  }
  if (/stairs|steps/.test(p))
    return {
      met: a.unit.landed,
      why: a.unit.landed ? tr("landed, has stairs") : tr("single level"),
    };
  if (/\blift|elevator/.test(p))
    return {
      met: !a.unit.landed,
      why: a.unit.landed ? "landed" : tr("high-rise with lifts"),
    };
  if (/landed|terrace|semi|bungalow|\bhouse\b/.test(p))
    return { met: a.unit.landed, why: a.unit.type };
  if (/condo|high.?rise|apartment|strata|serviced/.test(p))
    return { met: !a.unit.landed, why: a.unit.type };
  if (/toll/.test(p)) {
    const t = a.you.cost?.tolls;
    if (!t) return { met: null, why: tr("commute not compared") };
    return {
      met: t.oneWayRM > 0,
      why:
        t.oneWayRM > 0
          ? tr("about {amount} each way (estimated)", { amount: money(t.oneWayRM) })
          : tr("no toll on our estimate"),
    };
  }
  if (/short commute|near (work|office)|close to (work|office)/.test(p)) {
    if (!a.you.compared) return { met: false, why: tr("not a daily commute") };
    return {
      met: a.you.oneWayMin <= 45,
      why: tr("{n} min one way", { n: a.you.oneWayMin }),
    };
  }
  if (/jam|traffic|long commute|far from (work|office)|commute/.test(p)) {
    if (!a.you.compared) return { met: true, why: tr("not a daily commute") };
    return {
      met: a.you.oneWayMin > 60,
      why: tr("{n} min one way at peak", { n: a.you.oneWayMin }),
    };
  }
  if (/school/.test(p)) {
    if (a.primaryWithin === null)
      return { met: null, why: tr("no school data here yet") };
    const near = [...a.schools].sort((x, y) => x.km - y.km)[0];
    return {
      met: Boolean(a.primaryWithin || a.secondaryWithin),
      why: near
        ? tr("nearest {name}, {km} km", { name: near.name, km: near.km.toFixed(1) })
        : tr("none nearby"),
    };
  }
  if (/under construction|not ready|wait/.test(p))
    return { met: a.waitYears > 0, why: tr("keys {year}", { year: a.unit.completion }) };
  if (/ready|move in now|completed/.test(p))
    return { met: a.waitYears === 0, why: tr("keys {year}", { year: a.unit.completion }) };
  if (/small|cramped|tiny|squeez/.test(p))
    return {
      met: a.bedsShort > 0 || a.unit.builtUpSqft < 900,
      why: `${a.unit.beds} bed, ${a.unit.builtUpSqft.toLocaleString("en-MY")} sq ft`,
    };
  if (/pet|dog|cat/.test(p))
    return a.unit.landed
      ? { met: true, why: tr("landed: pets usually fine") }
      : { met: null, why: tr("strata by-laws decide, ask") };
  if (/over budget|expensive|pricey|stretch/.test(p))
    return {
      met: a.fit !== "in",
      why:
        a.fit === "in"
          ? tr("within budget")
          : a.fit === "over"
            ? tr("an over-budget price")
            : tr("a stretch price"),
    };
  if (/gated|guard|security/.test(p)) return has(/gated|guard\w*|security/);
  const amen = p.match(
    /pool|gym|park|lake|mall|club\s?house|playground|jogging|wetland|hospital|shop\w*|cycl\w*|nature|green|river|forest|hill/,
  );
  if (amen)
    return has(new RegExp(`${amen[0].replace(/\s/g, "").slice(0, 4)}\\w*`));
  void ctx;
  return { met: null, why: tr("can't check from our data, ask the sales gallery") };
}

export function profileChecks(
  fighters: HomeAnalysis[],
  ctx: BattleContext,
  tr: TFn = en,
): Check[] {
  const mk = (text: string, kind: Check["kind"]): Check => ({
    text,
    kind,
    results: Object.fromEntries(
      fighters.map((a) => {
        const f = hasFeature(text, a, ctx, tr);
        const ok: CheckOk =
          f.met === null
            ? "unknown"
            : (kind === "must") === f.met
              ? "yes"
              : "no";
        return [a.unit.id, { ok, why: f.why }];
      }),
    ),
  });
  return [
    ...ctx.mustHaves.map((t) => mk(t, "must")),
    ...ctx.mustBeNear.map((t) => mk(t, "must")),
    ...ctx.dealBreakers.map((t) => mk(t, "never")),
  ].slice(0, 10);
}

/* ---------------------------------------------------------------- lineup */

export type LineupSource = "picks" | "liked" | "mixed" | "sample";

export const BATTLE_MAX = 5;

/**
 * Lineup to open with: the buyer's Battle picks (set by the swipe deck, best match first),
 * else their likes best match first, else a sample lineup from the top matches in different projects.
 */
export function startingLineup(
  s: { compare: string[]; liked: string[] },
  isUnit: (id: string) => boolean,
  ranked: Unit[],
): { ids: string[]; source: LineupSource } {
  const rank = new Map(ranked.map((u, i) => [u.id, i]));
  const picks = s.compare.filter(isUnit);
  if (picks.length >= 1)
    return { ids: picks.slice(0, BATTLE_MAX), source: "picks" };
  const liked = s.liked
    .filter(isUnit)
    .sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
  if (liked.length >= 2)
    return { ids: liked.slice(0, BATTLE_MAX), source: "liked" };
  const sample = sampleLineup(ranked, liked);
  if (liked.length === 1) return { ids: sample, source: "mixed" };
  return { ids: sample, source: "sample" };
}

/** Up to 3 homes: the given ids first, then the best match from each project not yet in. */
export function sampleLineup(ranked: Unit[], keep: string[] = []): string[] {
  const out = [...keep];
  const projects = new Set(
    ranked.filter((u) => keep.includes(u.id)).map((u) => u.townshipId),
  );
  for (const u of ranked) {
    if (out.length >= 3) break;
    if (out.includes(u.id) || projects.has(u.townshipId)) continue;
    out.push(u.id);
    projects.add(u.townshipId);
  }
  return out;
}
