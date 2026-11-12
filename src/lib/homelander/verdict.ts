import {
  affordability,
  anchorOptions,
  costOfUnit,
  driveMinutes,
  samplePayslip,
  townshipById,
  transitMinutes,
  type Unit,
} from "./data";
import type { Answers } from "./store";

export type Scored = {
  unit: Unit;
  total: number;
  commute: number;
  space: number;
  money: number;
  weeklyHours: number;
  bedsNeeded: number;
  overBudget: boolean;
  leftoverRM: number | null;
  upfrontRM: number;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function oneWayMinutes(unit: Unit, anchorId: string, mode: Answers["mode"]) {
  const anchor = anchorOptions.find((a) => a.id === anchorId) ?? anchorOptions[0]!;
  const home = townshipById[unit.townshipId]!.pos;
  return mode === "train" ? transitMinutes(home, anchor.pos).minutes : driveMinutes(home, anchor.pos);
}

/** Scores each shortlisted unit 0-100 on commute, space and money, weighted by what the buyer said matters. */
export function scoreShortlist(list: Unit[], answers: Answers, anchorId: string, scanned: boolean): Scored[] {
  const budget = scanned ? affordability(samplePayslip) : null;
  const bedsNeeded = 2 + (answers.kids === "yes" ? 1 : 0) + (answers.parents === "yes" ? 1 : 0);
  const w =
    answers.priority === "time" ? { commute: 0.45, space: 0.25, money: 0.3 } : { commute: 0.25, space: 0.45, money: 0.3 };

  return list
    .map((unit) => {
      const weeklyHours = (oneWayMinutes(unit, anchorId, answers.mode) * 2 * answers.officeDays) / 60;
      // 2 h a week or less scores 100; every extra hour costs 6 points (17 h ≈ 10).
      const commute = clamp(100 - Math.max(weeklyHours - 2, 0) * 6);
      const landedBonus = unit.landed && (answers.kids === "yes" || answers.parents === "yes") ? 10 : 0;
      const space = clamp((unit.beds >= bedsNeeded ? 90 : 90 - 35 * (bedsNeeded - unit.beds)) + landedBonus);

      const cost = budget ? costOfUnit(unit.priceRM, budget.netRM, budget.commitmentsRM) : null;
      const overBudget = budget ? unit.priceRM > budget.maxPriceRM : false;
      const money = !budget || !cost ? 60 : overBudget ? 0 : clamp((cost.leftover / budget.netRM) * 160);

      const total = clamp(commute * w.commute + space * w.space + money * w.money);
      return {
        unit,
        total,
        commute,
        space,
        money,
        weeklyHours,
        bedsNeeded,
        overBudget,
        leftoverRM: cost ? cost.leftover : null,
        upfrontRM: cost ? cost.upfront : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Two or three plain sentences on why the winner beats the runner-up. */
export function verdictReasons(scored: Scored[]) {
  const [best, next] = scored;
  if (!best) return [];
  const out: string[] = [];
  if (!next) return [`${best.unit.name} is the only home left on your list.`];

  const hours = next.weeklyHours - best.weeklyHours;
  if (hours >= 0.5) out.push(`It gives you back ${hours.toFixed(1)} hours a week compared with ${next.unit.name}.`);
  else if (hours <= -0.5)
    out.push(`It costs you ${Math.abs(hours).toFixed(1)} more hours a week on the road than ${next.unit.name}, and still wins.`);

  if (next.overBudget) out.push(`${next.unit.name} is over what the bank is likely to lend you.`);
  else if (best.leftoverRM !== null && next.leftoverRM !== null && best.leftoverRM - next.leftoverRM > 150) {
    out.push(`You keep about RM${Math.round(best.leftoverRM - next.leftoverRM).toLocaleString("en-MY")} more each month.`);
  }

  if (best.unit.beds >= best.bedsNeeded && next.unit.beds < next.bedsNeeded) {
    out.push(`${next.unit.name} has ${next.unit.beds} bedrooms; you told us you need ${next.bedsNeeded}.`);
  } else if (best.unit.beds < best.bedsNeeded) {
    out.push(`Watch out: it has ${best.unit.beds} bedrooms and you said you need ${best.bedsNeeded}.`);
  }

  if (!out.length) out.push(`It edges ${next.unit.name} on the things you said matter most.`);
  return out.slice(0, 3);
}
