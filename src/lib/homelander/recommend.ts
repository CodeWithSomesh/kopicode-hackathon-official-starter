import {
  anchorOptions,
  availabilityOf,
  driveMinutes,
  nearestStation,
  rmShort,
  townshipById,
  transitMinutes,
  units,
  type Anchor,
  type Unit,
} from "./data";
import type { Profile } from "./profile";
import type { Budget } from "./store";

/**
 * Rule-based recommendations: every home gets a 0-100 match score from what Uncle learned,
 * plus the plain reasons behind it. Explainable on purpose: buyers and Gamuda can see why.
 * Over-budget homes are kept (tagged "stretch" or "over") but ranked lower.
 */

export type Fit = "in" | "stretch" | "over" | "unknown";

export type Pick = {
  unit: Unit;
  score: number;
  fit: Fit;
  /** Best reasons first; the card shows the top two. */
  reasons: string[];
  /** Honest catches, e.g. over budget or short a bedroom. */
  catches: string[];
};

const STRETCH = 0.1;

/** Best guess of the buyer's workplace among our commute anchors, from what they told Uncle. */
export function anchorFor(workArea: string | undefined): Anchor | null {
  if (!workArea) return null;
  const w = workArea.toLowerCase();
  const aliases: Record<string, string[]> = {
    "bangsar-south": ["bangsar", "kerinchi", "mid valley"],
    "kl-sentral": ["sentral", "kl central", "brickfields"],
    klcc: ["klcc", "bukit bintang", "kl city", "kuala lumpur", "trx", "ampang"],
    pj: ["petaling jaya", "pj", "damansara", "uptown", "subang", "kelana jaya"],
    cyberjaya: ["cyberjaya", "ciberjaya", "putrajaya"],
    "shah-alam": ["shah alam", "klang", "kota kemuning"],
    kajang: ["kajang", "cheras", "bangi", "serdang"],
  };
  const hit = anchorOptions.find((a) => w.includes(a.name.toLowerCase()) || aliases[a.id]?.some((k) => w.includes(k)));
  return hit ?? null;
}

export function bedroomsNeeded(p: Profile) {
  if (p.minBedrooms) return p.minBedrooms;
  let n = p.livingWith === "alone" ? 1 : 2;
  if ((p.kidsNow ?? 0) > 0 || p.kidsPlanned === "yes") n += 1;
  if (p.parentsMovingIn) n += 1;
  return n;
}

export function fitFor(price: number, budget: Budget | null): Fit {
  if (!budget || !budget.maxPriceRM) return "unknown";
  if (price <= budget.maxPriceRM) return "in";
  if (price <= budget.maxPriceRM * (1 + STRETCH)) return "stretch";
  return "over";
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function scoreUnit(unit: Unit, p: Profile, budget: Budget | null, work: Anchor | null): Pick {
  const t = townshipById[unit.townshipId]!;
  const reasons: [number, string][] = [];
  const catches: string[] = [];
  let score = 0;

  // Budget: 30
  const fit = fitFor(unit.priceRM, budget);
  if (fit === "in") {
    score += 30;
    reasons.push([30, `Within your ${rmShort(budget!.maxPriceRM)} budget`]);
  } else if (fit === "stretch") {
    score += 14;
    catches.push(`A stretch: ${rmShort(unit.priceRM - budget!.maxPriceRM)} over your limit`);
  } else if (fit === "over") {
    catches.push(`Over budget by ${rmShort(unit.priceRM - budget!.maxPriceRM)}`);
  } else score += 18;

  // Home type: 15
  if (!p.homeType || p.homeType === "either") score += 10;
  else if ((p.homeType === "landed") === unit.landed) {
    score += 15;
    reasons.push([12, unit.landed ? "Landed, like you wanted" : "High-rise, like you wanted"]);
  } else catches.push(unit.landed ? "Landed, you wanted high-rise" : "High-rise, you wanted landed");

  // Space: 15
  const need = bedroomsNeeded(p);
  if (unit.beds >= need) {
    score += 15;
    reasons.push([10, `${unit.beds} bedrooms for your ${need}`]);
  } else if (unit.beds === need - 1) {
    score += 6;
    catches.push(`${unit.beds} bedrooms, you need ${need}`);
  } else catches.push(`Only ${unit.beds} bedrooms for your ${need}`);

  // Commute: 20
  if (work) {
    const oneWay = p.commuteMode === "train" ? transitMinutes(t.pos, work.pos).minutes : p.commuteMode === "car" ? driveMinutes(t.pos, work.pos) : Math.min(driveMinutes(t.pos, work.pos), transitMinutes(t.pos, work.pos).minutes);
    const weekly = (oneWay * 2 * (p.officeDays ?? 5)) / 60;
    const pts = clamp(20 - Math.max(weekly - 3, 0) * 2, 0, 20);
    score += pts;
    const how = p.commuteMode === "train" ? "by train" : p.commuteMode === "car" ? "by car" : "";
    if (pts >= 12) reasons.push([pts, `${weekly.toFixed(1)} h a week to ${work.name} ${how}`.trim()]);
    else if (weekly > 10) catches.push(`${weekly.toFixed(1)} h a week commuting to ${work.name}`);
  } else score += 10;

  // Places they like: 15
  const where = `${t.name} ${t.area}`.toLowerCase();
  const liked = (p.preferredAreas ?? []).find((a) => a.length > 1 && where.includes(a.toLowerCase()));
  if (liked) {
    score += 15;
    reasons.push([25, `In ${liked}, an area you like`]);
  }
  const wantsRail = (p.mustBeNear ?? []).some((m) => /mrt|lrt|ktm|train|rail|station/i.test(m));
  if (wantsRail) {
    const st = nearestStation(t.pos);
    if (st.km <= 1.5) {
      score += 5;
      reasons.push([14, `${st.km.toFixed(1)} km to ${st.station.name} station`]);
    } else catches.push(`${st.km.toFixed(1)} km to the nearest station`);
  }

  // Timing: 5
  const thisYear = 2026;
  if (p.underConstructionOk === false && unit.completion > thisYear) catches.push(`Ready only in ${unit.completion}`);
  else score += 5;

  // Gamuda sells new homes; completed townships are resale examples, shown after what's on sale.
  if (t.status === "completed") {
    score -= 20;
    catches.unshift("Completed township: resale only, sample price");
  }

  if (availabilityOf(unit.id).status === "Sold out") {
    score = Math.min(score, 10);
    catches.unshift("Sold out right now");
  }

  return {
    unit,
    score: Math.round(clamp(score, 0, 100)),
    fit,
    reasons: reasons.sort((a, b) => b[0] - a[0]).map(([, r]) => r),
    catches,
  };
}

/** Every home, best match first. Sold-out homes and homes far over budget sink to the end. */
export function recommend(p: Profile, budget: Budget | null, work: Anchor | null): Pick[] {
  return units.map((u) => scoreUnit(u, p, budget, work)).sort((a, b) => b.score - a.score);
}

export const LIKES_TO_BATTLE = 3;
export const DECK_LIKE_LIMIT = 10;
export const BATTLE_MAX = 5;
