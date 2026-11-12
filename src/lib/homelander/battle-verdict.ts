import {
  analyseHome,
  effectiveWeights,
  rawScore,
  statsOf,
  unjudged,
  STATS,
  type HomeAnalysis,
  type StatKey,
  type Stats,
  type Weights,
} from "./analysis";
import type { BattleContext } from "./battle-context";
import { rm, type Unit } from "./data";

/**
 * The fight itself: score every home, pick a winner, and explain it in numbers a buyer can
 * check against the table. Sold-out homes cannot win while anything else is for sale.
 */

export type Fighter = HomeAnalysis & {
  stats: Stats;
  /** Weighted score minus profile penalties, 0-100, rounded for display. */
  overall: number;
  /** The same before rounding: what the ranking (and the fight's HP) really uses. */
  exact: number;
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
  /** The weights really used: categories we can't judge are zero. */
  weights: Weights;
  /** Categories left out of the fight, with the reason (missing inputs). */
  skipped: Partial<Record<StatKey, string>>;
};

/* ---------------------------------------------------------------- formatting */

const k = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `RM${(n / 1_000_000).toFixed(2)}M`
    : `RM${Math.round(n / 1000)}k`;
const money = (n: number) => rm(Math.round(n));
const pct = (f: number) => `${Math.round(Math.abs(f) * 100)}%`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
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
): Battle | null {
  if (list.length === 0) return null;
  const skipped = unjudged(ctx);
  const w = effectiveWeights(weights, ctx);
  const analysed = list.map((u) => analyseHome(u, ctx));
  const checks = profileChecks(analysed, ctx);
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
    const raw = rawScore(stats, w);
    return {
      ...a,
      stats,
      overall: Math.max(Math.round(raw) - penalty, 0),
      exact: raw - penalty,
      penalty,
      rank: 0,
      match: matchOf(a.unit),
    };
  });
  const order = [...fighters].sort(
    (a, b) =>
      Number(a.soldOut) - Number(b.soldOut) ||
      b.exact - a.exact ||
      b.match - a.match,
  );
  order.forEach((f, i) => (f.rank = i + 1));
  const winner = order[0]!;
  const runnerUp = order[1] ?? null;
  return {
    fighters,
    winner,
    runnerUp,
    reasons: reasonsFor(winner, runnerUp, w, ctx, fighters, checks),
    caveats: caveatsFor(winner, runnerUp, ctx, checks),
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
    weights: w,
    skipped,
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
): string[] {
  if (!next)
    return [
      `${best.unit.name} is the only home in the ring. Add another to compare.`,
    ];
  const out: { score: number; text: string; keys: StatKey[] }[] = [];
  const gap = (key: StatKey) => (best.stats[key] - next.stats[key]) * w[key];
  const vs = next.unit.name;

  const dMonth = next.totalMonthlyRM - best.totalMonthlyRM;
  const bothCommute = best.you.compared && next.you.compared;
  const dHours = bothCommute
    ? next.you.hoursPerYear - best.you.hoursPerYear
    : 0;
  if (dMonth >= 50 && dHours >= 20) {
    out.push({
      keys: ["monthly", "commute"],
      score: gap("monthly") + gap("commute") + 50,
      text: `Saves about ${money(dMonth)} a month and ${dHours} hours a year of commuting vs ${vs} (${best.you.oneWayMin} vs ${next.you.oneWayMin} min one way by ${best.you.mode}).`,
    });
  } else {
    if (dMonth >= 50) {
      const dInst = next.instalmentRM - best.instalmentRM;
      const dComm = next.you.monthlyRM - best.you.monthlyRM;
      const parts = [
        Math.abs(dInst) >= 20
          ? `instalment ${dInst > 0 ? "-" : "+"}${money(Math.abs(dInst))}`
          : null,
        bothCommute && Math.abs(dComm) >= 20
          ? `commute ${dComm > 0 ? "-" : "+"}${money(Math.abs(dComm))}`
          : null,
      ].filter(Boolean);
      out.push({
        keys: ["monthly"],
        score: gap("monthly") + 20,
        text: `About ${money(dMonth)} a month cheaper to live in than ${vs}${parts.length ? ` (${parts.join(", ")})` : ""}.`,
      });
    }
    if (dHours >= 20)
      out.push({
        keys: ["commute"],
        score: gap("commute") + 10,
        text: `${dHours} fewer hours a year getting to ${ctx.workLabel ?? "work"} than from ${vs} (${best.you.oneWayMin} vs ${next.you.oneWayMin} min one way by ${best.you.mode}).`,
      });
  }
  if (best.you.compared && !next.you.compared)
    out.push({
      keys: ["commute"],
      score: 300,
      text: `You can commute to ${ctx.workLabel ?? "work"} from here. ${vs} is not a daily commute.`,
    });

  if (best.partner?.compared && next.partner?.compared) {
    const dp = next.partner.hoursPerYear - best.partner.hoursPerYear;
    if (dp >= 30)
      out.push({
        keys: ["commute"],
        score: gap("commute") / 2,
        text: `Your partner gets back ${dp} hours a year too, going to ${best.partner.label}.`,
      });
  }

  if (next.fit !== "in" && best.fit === "in")
    out.push({
      keys: ["monthly"],
      score: gap("monthly") + 200,
      text: `${vs} is ${next.fit === "over" ? "over" : "a stretch on"} the roughly ${k(ctx.money.maxPriceRM)} the bank may lend against (${k(next.priceRM)}); this one fits at ${k(best.priceRM)}.`,
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
          ? `: your ${k(sav)} savings cover it, but not ${vs}`
          : "";
    out.push({
      keys: ["cash"],
      score: gap("cash") + (tail ? 80 : 10),
      text: `Needs ${k(dUp)} less cash upfront (${k(best.upfrontRM)} vs ${k(next.upfrontRM)})${tail}.`,
    });
  }

  if (next.bedsShort > best.bedsShort)
    out.push({
      keys: ["space"],
      score: gap("space") + 100,
      text: `${plural(best.unit.beds, "bedroom")} for the ${ctx.bedsNeeded} you need; ${vs} has ${next.unit.beds}.`,
    });
  else if (best.unit.builtUpSqft - next.unit.builtUpSqft >= 200)
    out.push({
      keys: ["space"],
      score: gap("space"),
      text: `${(best.unit.builtUpSqft - next.unit.builtUpSqft).toLocaleString("en-MY")} sq ft more floor space (${best.unit.builtUpSqft.toLocaleString("en-MY")} vs ${next.unit.builtUpSqft.toLocaleString("en-MY")}).`,
    });

  if (next.psfVsType - best.psfVsType >= 0.05)
    out.push({
      keys: ["value"],
      score: gap("value"),
      text: `Better value: RM${Math.round(best.psf)} psf is ${pct(best.psfVsType)} ${best.psfVsType <= 0 ? "under" : "over"} the average ${typeWord(best.unit)}; ${vs} is ${pct(next.psfVsType)} ${next.psfVsType <= 0 ? "under" : "over"} its type.`,
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
      text: `A primary school within your ${ctx.schoolMaxKm} km${s ? ` (${s.name}, ${s.km.toFixed(1)} km)` : ""}; ${vs} has none that close.`,
    });
  }

  if (next.waitYears > best.waitYears)
    out.push({
      keys: ["ready"],
      score: gap("ready") + (next.waitConflict ? 80 : 0),
      text:
        best.waitYears === 0
          ? `Keys ${best.unit.completion <= ctx.year ? "now" : `in ${best.unit.completion}`}: no years of paying rent on top of the loan, unlike ${vs} (${next.unit.completion}).`
          : `Keys ${plural(next.waitYears - best.waitYears, "year")} sooner (${best.unit.completion} vs ${next.unit.completion}).`,
    });

  if (best.unit.tenure === "Freehold" && next.unit.tenure === "Leasehold")
    out.push({
      keys: ["value"],
      score: 15,
      text: `Freehold, so no lease running down. ${vs} is leasehold.`,
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
        text: `${vs} ${hit.kind === "never" ? "hits your deal-breaker" : "misses your must-have"} "${hit.text}" (${hit.results[next.unit.id]!.why}); this one doesn't.`,
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
        text: `Cheapest to live in of all ${n}: ${money(best.totalMonthlyRM)} a month all-in${best.leftRM !== null ? `, leaving ${money(best.leftRM)}` : ""}.`,
      },
      {
        key: "commute",
        ok:
          best.you.compared &&
          rivals.every(
            (r) =>
              !r.you.compared || r.you.hoursPerYear > best.you.hoursPerYear,
          ),
        text: `Shortest commute of all ${n}: ${best.you.hoursPerYear} hours a year, ${best.you.oneWayMin} min each way by ${best.you.mode}.`,
      },
      {
        key: "cash",
        ok: rivals.every((r) => r.upfrontRM > best.upfrontRM),
        text: `Least cash upfront of all ${n}: ${k(best.upfrontRM)}.`,
      },
      {
        key: "space",
        ok: rivals.every((r) => r.unit.builtUpSqft < best.unit.builtUpSqft),
        text: `Most floor space of all ${n}: ${best.unit.builtUpSqft.toLocaleString("en-MY")} sq ft, ${plural(best.unit.beds, "bedroom")}.`,
      },
      {
        key: "value",
        ok: rivals.every((r) => r.psfVsType > best.psfVsType),
        text: `Best value of all ${n} against its type: RM${Math.round(best.psf)} psf, ${pct(best.psfVsType)} ${best.psfVsType <= 0 ? "under" : "over"} the average ${typeWord(best.unit)}.`,
      },
      {
        key: "ready",
        ok: best.waitYears === 0 && rivals.some((r) => r.waitYears > 0),
        text: `Ready now (keys ${best.unit.completion}), while ${rivals.filter((r) => r.waitYears > 0).length} of the others are still being built.`,
      },
      {
        key: "fit",
        ok: best.fit === "in" && best.dsrAfter !== null && best.dsrAfter <= 0.6,
        text: `Comfortably inside your budget: ${k(ctx.money.maxPriceRM - best.priceRM)} under the bank ceiling, debt service ratio ${pct(best.dsrAfter ?? 0)} with this loan.`,
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
        `Scores higher on ${l.s.label.toLowerCase()}: ${best.stats[l.s.key]} vs ${next.stats[l.s.key]} (${l.s.hint.toLowerCase()}).`,
      );
  }
  if (picked.length < 2)
    picked.push(
      `On your priorities it edges ${vs} overall, ${best.overall} vs ${next.overall}.`,
    );
  return picked;
}

/* ---------------------------------------------------------------- caveats */

export function caveatsFor(
  best: Fighter,
  next: Fighter | null,
  ctx: BattleContext,
  checks: Check[],
): string[] {
  const out: string[] = [];
  const m = ctx.money;
  if (best.soldOut)
    out.push(
      "Every home in the ring is sold out. Ask the sales gallery about the next phase.",
    );
  if (best.fit === "stretch" || best.fit === "over")
    out.push(
      `At ${k(best.priceRM)} it is ${best.fit === "over" ? "over" : "a stretch on"} the roughly ${k(m.maxPriceRM)} the bank may lend against.`,
    );
  if (best.dsrAfter !== null && best.dsrAfter > 0.6)
    out.push(
      `Your debt service ratio would be ${pct(best.dsrAfter)} with this loan: above the common 60% line${best.dsrAfter <= 0.7 ? ", though some banks go to 70%" : " and the 70% some banks allow"}.`,
    );
  if (best.savingsGapRM !== null && best.savingsGapRM < 0)
    out.push(
      `You'd be ${k(-best.savingsGapRM)} short on cash upfront (needs ${k(best.upfrontRM)}).`,
    );
  if (best.leftRM !== null && best.leftRM < m.netRM * 0.15)
    out.push(
      `Tight: about ${money(best.leftRM)} left a month once the loan, fees, commute and other debts are paid.`,
    );
  if (best.bedsShort > 0)
    out.push(
      `${plural(best.unit.beds, "bedroom")}, and you said you need ${ctx.bedsNeeded}.`,
    );
  if (best.waitConflict)
    out.push(
      `Keys only in ${best.unit.completion}, and you said a home under construction is not OK.`,
    );
  else if (best.waitYears >= 2)
    out.push(
      `Keys in ${best.unit.completion}: ${plural(best.waitYears, "year")} of waiting, maybe while paying rent.`,
    );
  if (!best.you.compared && !best.you.missing && best.you.notComparedWhy)
    out.push(best.you.notComparedWhy);
  else if (best.you.hoursPerYear > 350)
    out.push(
      `${best.you.hoursPerYear} hours a year commuting is a lot: about ${Math.round(best.you.hoursPerYear / 8)} working days.`,
    );
  if (best.unit.tenure === "Leasehold")
    out.push("Leasehold: ask how many years are left on the lease.");
  if (!best.soldOut && best.availability.left <= 7)
    out.push(
      `Only ${best.availability.left} left in ${best.availability.phase} (sample count).`,
    );

  for (const c of checks) {
    const r = c.results[best.unit.id];
    if (r?.ok === "no")
      out.push(
        `${c.kind === "must" ? "Missing your must-have" : "Hits your deal-breaker"} "${c.text}": ${r.why}.`,
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
      out.push(
        `${next.unit.name} still beats it on ${top.s.label.toLowerCase()} (${next.stats[top.s.key]} vs ${best.stats[top.s.key]}).`,
      );
  }
  if (m.savingsRM === null)
    out.push("Tell Uncle your savings and we can judge the cash upfront.");
  if (m.source === "missing")
    out.push(
      "Uncle doesn't know your salary yet, so budget fit and money left each month aren't judged.",
    );
  if (ctx.commuteMissing)
    out.push(`${ctx.commuteMissing} to compare commutes.`);
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
      ? { met: true, why: `listed: "${hit[0]}"` }
      : { met: null, why: "not in our listing, ask the sales gallery" };
  };

  if (/\b(mrt|lrt|ktm|train|rail|station|transit)\b/.test(p))
    return {
      met: a.stationKm <= 1.5,
      why: `${a.stationKm.toFixed(1)} km to ${a.stationName}`,
    };
  if (/leasehold/.test(p))
    return { met: a.unit.tenure === "Leasehold", why: a.unit.tenure };
  if (/freehold/.test(p))
    return { met: a.unit.tenure === "Freehold", why: a.unit.tenure };
  if (/(\d+)\s*(bed|room|br)/.test(p)) {
    const n = Number(p.match(/(\d+)\s*(bed|room|br)/)![1]);
    return { met: a.unit.beds >= n, why: `${plural(a.unit.beds, "bedroom")}` };
  }
  if (/stairs|steps/.test(p))
    return {
      met: a.unit.landed,
      why: a.unit.landed ? "landed, has stairs" : "single level",
    };
  if (/\blift|elevator/.test(p))
    return {
      met: !a.unit.landed,
      why: a.unit.landed ? "landed" : "high-rise with lifts",
    };
  if (/landed|terrace|semi|bungalow|\bhouse\b/.test(p))
    return { met: a.unit.landed, why: a.unit.type };
  if (/condo|high.?rise|apartment|strata|serviced/.test(p))
    return { met: !a.unit.landed, why: a.unit.type };
  if (/toll/.test(p)) {
    const t = a.you.cost?.tolls;
    if (!t) return { met: null, why: "commute not compared" };
    return {
      met: t.oneWayRM > 0,
      why:
        t.oneWayRM > 0
          ? `about ${money(t.oneWayRM)} each way (estimated)`
          : "no toll on our estimate",
    };
  }
  if (a.you.missing && /commute|jam|traffic|(work|office)/.test(p))
    return { met: null, why: a.you.missing.toLowerCase() };
  if (/short commute|near (work|office)|close to (work|office)/.test(p)) {
    if (!a.you.compared) return { met: false, why: "not a daily commute" };
    return {
      met: a.you.oneWayMin <= 45,
      why: `${a.you.oneWayMin} min one way`,
    };
  }
  if (/jam|traffic|long commute|far from (work|office)|commute/.test(p)) {
    if (!a.you.compared) return { met: true, why: "not a daily commute" };
    return {
      met: a.you.oneWayMin > 60,
      why: `${a.you.oneWayMin} min one way at peak`,
    };
  }
  if (/school/.test(p)) {
    if (a.primaryWithin === null)
      return { met: null, why: "no school data here yet" };
    const near = [...a.schools].sort((x, y) => x.km - y.km)[0];
    return {
      met: Boolean(a.primaryWithin || a.secondaryWithin),
      why: near
        ? `nearest ${near.name}, ${near.km.toFixed(1)} km`
        : "none nearby",
    };
  }
  if (/under construction|not ready|wait/.test(p))
    return { met: a.waitYears > 0, why: `keys ${a.unit.completion}` };
  if (/ready|move in now|completed/.test(p))
    return { met: a.waitYears === 0, why: `keys ${a.unit.completion}` };
  if (/small|cramped|tiny|squeez/.test(p))
    return {
      met: a.bedsShort > 0 || a.unit.builtUpSqft < 900,
      why: `${a.unit.beds} bed, ${a.unit.builtUpSqft.toLocaleString("en-MY")} sq ft`,
    };
  if (/pet|dog|cat/.test(p))
    return a.unit.landed
      ? { met: true, why: "landed: pets usually fine" }
      : { met: null, why: "strata by-laws decide, ask" };
  if (/over budget|expensive|pricey|stretch/.test(p))
    return {
      met: a.fit !== "in",
      why:
        a.fit === "in"
          ? "within budget"
          : `a ${a.fit === "over" ? "over-budget" : "stretch"} price`,
    };
  if (/gated|guard|security/.test(p)) return has(/gated|guard\w*|security/);
  const amen = p.match(
    /pool|gym|park|lake|mall|club\s?house|playground|jogging|wetland|hospital|shop\w*|cycl\w*|nature|green|river|forest|hill/,
  );
  if (amen)
    return has(new RegExp(`${amen[0].replace(/\s/g, "").slice(0, 4)}\\w*`));
  void ctx;
  return { met: null, why: "can't check from our data, ask the sales gallery" };
}

export function profileChecks(
  fighters: HomeAnalysis[],
  ctx: BattleContext,
): Check[] {
  const mk = (text: string, kind: Check["kind"]): Check => ({
    text,
    kind,
    results: Object.fromEntries(
      fighters.map((a) => {
        const f = hasFeature(text, a, ctx);
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

export type LineupSource = "picks" | "liked" | "few";

export const BATTLE_MAX = 5;
/** A battle needs at least this many homes. */
export const BATTLE_MIN = 2;

/**
 * Lineup to open with, from the buyer's own choices only (never a made-up sample): their Battle
 * picks (set by the swipe deck), else their likes best match first. With fewer than two, the
 * screen asks them to pick more.
 */
export function startingLineup(
  s: { compare: string[]; liked: string[] },
  isUnit: (id: string) => boolean,
  ranked: Unit[],
): { ids: string[]; source: LineupSource } {
  const rank = new Map(ranked.map((u, i) => [u.id, i]));
  const picks = [...new Set(s.compare.filter(isUnit))];
  if (picks.length >= BATTLE_MIN)
    return { ids: picks.slice(0, BATTLE_MAX), source: "picks" };
  const liked = [...new Set(s.liked.filter(isUnit))].sort(
    (a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999),
  );
  if (liked.length >= BATTLE_MIN)
    return { ids: liked.slice(0, BATTLE_MAX), source: "liked" };
  const few = [...new Set([...picks, ...liked])].slice(0, BATTLE_MAX);
  return { ids: few, source: few.length >= BATTLE_MIN ? "picks" : "few" };
}
