import { STATS, type StatKey } from "./analysis";
import type { BattleContext } from "./battle-context";
import type { Battle, Fighter } from "./battle-verdict";
import { rm } from "./data";

/**
 * The Battle screen's arcade fight, scripted from the real scores so it can't lie.
 *
 * One round per score category the fight can judge (weight above zero, inputs known), then a
 * round for must-haves / deal-breakers if any home fails one, then a sold-out round if some (not
 * all) homes are sold out.
 *
 * Damage: in a category round, each home loses (best score in the round − its score) × weight / Σ
 * weights, in score points. Summed over the rounds that is C − raw score (C is the same for every
 * home), and the checks round adds the penalty, so total damage = C − (raw − penalty) = C − exact.
 * HP = 100 − damage × scale with one scale for everyone, so the HP order at the end is exactly the
 * ranking runBattle() uses (exact score, sold-out homes last). Only an exact tie needs the
 * tie-break (swipe match), which the K.O. line says out loud.
 */

export type RoundKind = StatKey | "checks" | "soldout";

export type FightRound = {
  kind: RoundKind;
  title: string;
  /** What decides the round, in a few words. */
  hint: string;
  /** The real figure behind each fighter's score this round, by unit id. */
  figures: Record<string, string>;
  /** Ids that won the round (struck); empty on a draw. */
  winners: string[];
  /** HP lost this round, by unit id (already scaled). */
  damage: Record<string, number>;
  /** HP after this round, by unit id. */
  hpAfter: Record<string, number>;
};

export type FightScript = {
  rounds: FightRound[];
  /** Categories that sit this fight out, and why. */
  benched: { key: StatKey; label: string; why: string }[];
  finalHp: Record<string, number>;
  winnerId: string;
  /** True when the winner and runner-up tie on points and the swipe match breaks it. */
  tieBreak: boolean;
};

const MAX_DROP = 75;
const MAX_SCALE = 5;

const k = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `RM${(n / 1_000_000).toFixed(2)}M`
    : `RM${Math.round(n / 1000)}k`;

function figure(key: StatKey, f: Fighter, ctx: BattleContext): string {
  switch (key) {
    case "monthly":
      return `${rm(Math.round(f.totalMonthlyRM))}/mo`;
    case "cash":
      return `${k(f.upfrontRM)} upfront`;
    case "commute":
      return f.you.compared
        ? `${f.you.hoursPerYear} h/yr`
        : "Not a daily commute";
    case "space":
      return `${f.unit.beds} bed, ${f.unit.builtUpSqft.toLocaleString("en-MY")} sq ft`;
    case "family": {
      const life = f.worries.find(
        (w) =>
          (w.worry === "safety_security" || w.worry === "near_family") &&
          w.tone !== "unknown",
      );
      if (life)
        return `${life.label}: ${life.tone === "good" ? "eased" : life.tone === "bad" ? "not eased" : "so-so"}`;
      if (ctx.parentsMovingIn)
        return f.unit.landed ? "Stairs for parents" : "Lifts for parents";
      return f.bedsSpare > 0
        ? `${f.bedsSpare} spare room${f.bedsSpare === 1 ? "" : "s"}`
        : f.bedsShort > 0
          ? `${f.bedsShort} room${f.bedsShort === 1 ? "" : "s"} short`
          : "Rooms just right";
    }
    case "value":
      return `RM${Math.round(f.psf)} psf`;
    case "ready":
      return f.waitYears === 0 ? "Ready now" : `Keys ${f.unit.completion}`;
  }
}

const hintOf: Record<StatKey, string> = {
  monthly: "Money left each month after the loan, fees and commute",
  cash: "Down payment and fees against your savings",
  commute: "Hours a year getting to work",
  space: "Bedrooms for your household and floor area",
  family: "Safety, near family, parents, pets and room to grow",
  value: "Price per sq ft against similar homes",
  ready: "Years until the keys",
};

export function fightScript(battle: Battle, ctx: BattleContext): FightScript {
  const fs = battle.fighters;
  const w = battle.weights;
  const W = STATS.reduce((sum, s) => sum + w[s.key], 0);

  // Raw damage in score points, before scaling.
  type Raw = Omit<FightRound, "damage" | "hpAfter"> & {
    points: Record<string, number>;
  };
  const raws: Raw[] = [];
  const benched: FightScript["benched"] = [];

  for (const s of STATS) {
    const why = battle.skipped[s.key];
    if (why) {
      benched.push({ key: s.key, label: s.label, why });
      continue;
    }
    if (w[s.key] <= 0 || W <= 0) {
      benched.push({
        key: s.key,
        label: s.label,
        why: "You set this priority to zero",
      });
      continue;
    }
    const best = Math.max(...fs.map((f) => f.stats[s.key]));
    const allTie = fs.every((f) => f.stats[s.key] === best);
    raws.push({
      kind: s.key,
      title: s.label,
      hint: hintOf[s.key],
      // Space and family mix several things, so their score goes next to the headline figure.
      figures: Object.fromEntries(
        fs.map((f) => [
          f.unit.id,
          s.key === "space" || s.key === "family"
            ? `${figure(s.key, f, ctx)} (${f.stats[s.key]} pts)`
            : figure(s.key, f, ctx),
        ]),
      ),
      winners: allTie
        ? []
        : fs.filter((f) => f.stats[s.key] === best).map((f) => f.unit.id),
      points: Object.fromEntries(
        fs.map((f) => [f.unit.id, ((best - f.stats[s.key]) * w[s.key]) / W]),
      ),
    });
  }

  if (fs.some((f) => f.penalty > 0)) {
    const fails = (f: Fighter) =>
      battle.checks.filter((c) => c.results[f.unit.id]?.ok === "no").length;
    raws.push({
      kind: "checks",
      title: "Must-haves & deal-breakers",
      hint: "Each must-have missed or deal-breaker hit costs points",
      figures: Object.fromEntries(
        fs.map((f) => [
          f.unit.id,
          f.penalty > 0 ? `Fails ${fails(f)}, −${f.penalty}` : "All clear",
        ]),
      ),
      winners: fs.filter((f) => f.penalty === 0).map((f) => f.unit.id),
      points: Object.fromEntries(fs.map((f) => [f.unit.id, f.penalty])),
    });
  }

  const totals = fs.map((f) =>
    raws.reduce((sum, r) => sum + (r.points[f.unit.id] ?? 0), 0),
  );
  const maxD = Math.max(0, ...totals);
  const scale = maxD > 0 ? Math.min(MAX_DROP / maxD, MAX_SCALE) : 0;

  const hp: Record<string, number> = Object.fromEntries(
    fs.map((f) => [f.unit.id, 100]),
  );
  const rounds: FightRound[] = raws.map(({ points, ...r }) => {
    const damage: Record<string, number> = {};
    for (const f of fs) {
      const d = (points[f.unit.id] ?? 0) * scale;
      damage[f.unit.id] = d;
      hp[f.unit.id] = Math.max(hp[f.unit.id]! - d, 0);
    }
    return { ...r, damage, hpAfter: { ...hp } };
  });

  const sold = fs.filter((f) => f.soldOut);
  if (sold.length > 0 && sold.length < fs.length) {
    const damage: Record<string, number> = {};
    for (const f of fs) {
      const d = f.soldOut ? hp[f.unit.id]! : 0;
      damage[f.unit.id] = d;
      hp[f.unit.id] = hp[f.unit.id]! - d;
    }
    rounds.push({
      kind: "soldout",
      title: "Sold out",
      hint: "A home you can't buy can't win",
      figures: Object.fromEntries(
        fs.map((f) => [f.unit.id, f.soldOut ? "Sold out" : "For sale"]),
      ),
      winners: fs.filter((f) => !f.soldOut).map((f) => f.unit.id),
      damage,
      hpAfter: { ...hp },
    });
  }

  const ru = battle.runnerUp;
  return {
    rounds,
    benched,
    finalHp: { ...hp },
    winnerId: battle.winner.unit.id,
    tieBreak: ru !== null && ru.exact === battle.winner.exact,
  };
}
