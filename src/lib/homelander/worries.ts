import { maintenanceOf, typeAveragePsf, FIRST_HOME_EXEMPTION_CAP, type HomeAnalysis } from "./analysis";
import type { BattleContext } from "./battle-context";
import { costOfUnit, LOAN_RATE, LOAN_YEARS, monthlyInstalment, nearestStation, rmShort, townshipById, type Township, type Unit } from "./data";
import { painPointShort, type PainPoint, type Profile } from "./profile";

/**
 * How one home does on each of the buyer's worries (painPoints): a tone, a plain line that names
 * the worry, and a 0-100 score (null when we can't judge it from our data). Shared by the swipe
 * deck's ranking, the card details and Battle, so all three say the same thing.
 */

export type WorryTone = "good" | "warn" | "bad" | "unknown";

export type WorryCheck = {
  worry: PainPoint;
  label: string;
  tone: WorryTone;
  /** One line that names the worry, e.g. "Freehold, so the lease worry is off the table". */
  text: string;
  /** 0-100, higher eases the worry more; null when we can't judge it. */
  score: number | null;
};

/** Everything the checks need, from either the swipe deck or Battle. */
export type WorryFacts = {
  unit: Unit;
  township: Township;
  upfrontRM: number;
  savingsRM: number | null;
  firstHome: boolean | null;
  instalmentRM: number;
  /** Monthly take-home the bank counts; null when unknown. */
  netRM: number | null;
  commitmentsRM: number;
  /** Rough bank ceiling on the price; null when unknown. */
  maxPriceRM: number | null;
  maintenanceRM: number;
  maintenanceNote: string;
  /** Hours a week getting to work and back; null when we don't know where they work. */
  commuteHoursWeek: number | null;
  commuteFar: boolean;
  workName: string | null;
  stationKm: number;
  stationName: string;
  waitYears: number;
  year: number;
  /** Fraction above (+) or below (-) the average psf of the same home type. */
  psfVsType: number;
  places: string[];
  bedsShort: number;
  bedsSpare: number;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (f: number) => `${Math.round(Math.abs(f) * 100)}%`;
const rmPlain = (n: number) => `RM${Math.round(n).toLocaleString("en-MY")}`;

const SAFE = /gated|guard|security|24-hour|24 hour|access card/i;

/** The area the buyer named that this home is in, if any. */
export function placeHit(t: Township, places: string[]) {
  const where = `${t.name} ${t.area}`.toLowerCase();
  return places.find((a) => a.length > 1 && where.includes(a.toLowerCase())) ?? null;
}

export function checkWorry(worry: PainPoint, f: WorryFacts): WorryCheck {
  const base = { worry, label: painPointShort[worry] };
  const u = f.unit;
  switch (worry) {
    case "upfront_cash": {
      const waiver = f.firstHome !== false && u.priceRM <= FIRST_HOME_EXEMPTION_CAP;
      const waiverNote = waiver ? "; under RM500k, so the first-home stamp duty waiver may apply" : "";
      if (f.savingsRM !== null) {
        const gap = f.savingsRM - f.upfrontRM;
        const score = clamp((f.savingsRM / Math.max(f.upfrontRM, 1)) * 85 + (waiver ? 10 : 0));
        if (gap >= 0)
          return { ...base, tone: "good", score, text: `Your savings cover the ${rmShort(f.upfrontRM)} cash upfront, so the deposit worry is handled${waiverNote}` };
        return {
          ...base,
          tone: -gap <= f.upfrontRM * 0.2 ? "warn" : "bad",
          score,
          text: `${rmShort(-gap)} short of the ${rmShort(f.upfrontRM)} cash upfront (deposit, stamp duty, legal fees)${waiverNote}`,
        };
      }
      const score = clamp(100 - f.upfrontRM / 2500 + (waiver ? 10 : 0));
      return waiver
        ? { ...base, tone: "good", score, text: `Lighter on cash upfront: about ${rmShort(f.upfrontRM)}, and the first-home stamp duty waiver may apply under RM500k` }
        : { ...base, tone: f.upfrontRM <= 80_000 ? "warn" : "bad", score, text: `About ${rmShort(f.upfrontRM)} cash upfront for the deposit, stamp duty and legal fees` };
    }
    case "loan_approval": {
      if (!f.maxPriceRM) return { ...base, tone: "unknown", score: null, text: "Tell Mochi your salary to see how this sits with the bank" };
      const r = u.priceRM / f.maxPriceRM;
      if (r <= 0.85)
        return { ...base, tone: "good", score: 100, text: `Well inside the ~${rmShort(f.maxPriceRM)} banks may lend against, a safer loan application` };
      if (r <= 1) return { ...base, tone: "good", score: 75, text: `Within the ~${rmShort(f.maxPriceRM)} banks may lend against, so the loan should be in reach` };
      if (r <= 1.1)
        return { ...base, tone: "warn", score: 35, text: `A stretch: ${rmShort(u.priceRM - f.maxPriceRM)} over what banks may lend, so approval is harder` };
      return { ...base, tone: "bad", score: 5, text: `${rmShort(u.priceRM - f.maxPriceRM)} over what banks may lend: a real rejection risk` };
    }
    case "monthly_burden": {
      const inst = rmPlain(f.instalmentRM);
      if (!f.netRM)
        return { ...base, tone: "unknown", score: clamp(100 - f.instalmentRM / 60), text: `About ${inst} a month instalment; tell Mochi your salary to see how it fits` };
      const dsr = (f.commitmentsRM + f.instalmentRM) / f.netRM;
      const score = clamp(((0.75 - dsr) / 0.4) * 100);
      if (dsr <= 0.4) return { ...base, tone: "good", score, text: `Easy on the monthly: ${inst} a month, ${pct(dsr)} of take-home with your other loans` };
      if (dsr <= 0.6) return { ...base, tone: "warn", score, text: `${inst} a month takes your loans to ${pct(dsr)} of take-home` };
      return { ...base, tone: "bad", score, text: `${inst} a month takes your loans to ${pct(dsr)} of take-home: a heavy monthly burden` };
    }
    case "hidden_costs": {
      const fee = f.maintenanceRM;
      const score = clamp(100 - (fee - 120) / 5);
      if (fee <= 200) return { ...base, tone: "good", score, text: `Low running costs: about ${rmPlain(fee)} a month in fees (${f.maintenanceNote.toLowerCase()})` };
      return {
        ...base,
        tone: fee <= 450 ? "warn" : "bad",
        score,
        text: `About ${rmPlain(fee)} a month in maintenance, plus quit rent and assessment`,
      };
    }
    case "commute_traffic": {
      const rail = f.stationKm <= 1.5 ? `, and ${f.stationName} station is ${f.stationKm.toFixed(1)} km away to skip the jam` : "";
      if (f.commuteFar && f.workName) return { ...base, tone: "bad", score: 0, text: `Not a daily commute to ${f.workName}` };
      if (f.commuteHoursWeek !== null && f.workName) {
        const h = f.commuteHoursWeek;
        const score = clamp(100 - Math.max(h - 3, 0) * 9 + (rail ? 10 : 0));
        if (h <= 5) return { ...base, tone: "good", score, text: `Only ${h.toFixed(1)} h a week to ${f.workName}: less time stuck in traffic${rail}` };
        if (h <= 9) return { ...base, tone: "warn", score, text: `${h.toFixed(1)} h a week to ${f.workName} and back${rail}` };
        return { ...base, tone: "bad", score, text: `${h.toFixed(1)} h a week in traffic to ${f.workName}${rail}` };
      }
      const score = clamp(100 - f.stationKm * 10);
      return f.stationKm <= 1.5
        ? { ...base, tone: "good", score, text: `${f.stationKm.toFixed(1)} km to ${f.stationName} station, so you can skip the jam` }
        : { ...base, tone: "warn", score, text: `Nearest station ${f.stationKm.toFixed(1)} km away: mostly driving` };
    }
    case "build_delay": {
      const w = f.waitYears;
      const score = clamp(100 - 30 * w);
      if (w === 0)
        return { ...base, tone: "good", score, text: u.completion < f.year ? "Already built, so no waiting on the developer for keys" : `Keys in ${u.completion}, no long wait on the developer` };
      if (w === 1) return { ...base, tone: "warn", score, text: `Keys in ${u.completion}, about a year of waiting` };
      return { ...base, tone: "bad", score, text: `Keys in ${u.completion}: ${w} years of waiting on the build` };
    }
    case "resale_value": {
      const fh = u.tenure === "Freehold";
      const cheap = f.psfVsType <= 0;
      const score = clamp(50 + (fh ? 20 : -15) - 150 * f.psfVsType);
      const psf = `${pct(f.psfVsType)} ${cheap ? "below" : "above"} similar homes per sq ft`;
      if (fh && cheap) return { ...base, tone: "good", score, text: `Good for resale: freehold and ${psf}` };
      if (fh || cheap) return { ...base, tone: "warn", score, text: `For resale: ${fh ? "freehold" : "leasehold"}, ${psf}` };
      return { ...base, tone: "bad", score, text: `Harder to resell: leasehold and ${psf}` };
    }
    case "leasehold_worry":
      return u.tenure === "Freehold"
        ? { ...base, tone: "good", score: 100, text: "Freehold, so the lease worry is off the table" }
        : { ...base, tone: "bad", score: 20, text: "Leasehold: ask how many years are left on the lease" };
    case "safety_security": {
      const hit = [...u.highlights, ...(f.township.facilities ?? [])].find((x) => SAFE.test(x));
      if (hit) return { ...base, tone: "good", score: 95, text: `${hit}, for peace of mind on safety` };
      return u.landed
        ? { ...base, tone: "warn", score: 40, text: "Not listed as gated and guarded: ask the sales gallery about security" }
        : { ...base, tone: "warn", score: 60, text: "Strata security (guardhouse, access cards) is usual: check what's included" };
    }
    case "near_family": {
      if (!f.places.length) return { ...base, tone: "unknown", score: null, text: "Tell Mochi where your family lives to check this" };
      const hit = placeHit(f.township, f.places);
      return hit
        ? { ...base, tone: "good", score: 95, text: `In ${hit}, close to where you want to be` }
        : { ...base, tone: "bad", score: 25, text: `Not in the areas you named (${f.places.slice(0, 3).join(", ")})` };
    }
    case "space_too_small": {
      const sq = u.builtUpSqft.toLocaleString("en-MY");
      const score = clamp(u.builtUpSqft / 18 - 35 * f.bedsShort);
      if (f.bedsShort > 0) return { ...base, tone: "bad", score, text: `Only ${u.beds} bedrooms and ${sq} sq ft: short of the space you need` };
      if (u.builtUpSqft >= 1500 || f.bedsSpare > 0)
        return { ...base, tone: "good", score, text: `Room to breathe: ${sq} sq ft, ${u.beds} bedrooms` };
      return { ...base, tone: "warn", score, text: `${sq} sq ft, ${u.beds} bedrooms: just enough` };
    }
    case "flood_risk":
      return { ...base, tone: "unknown", score: null, text: "We don't have flood maps for this site yet: check the JPS public flood map before you book" };
  }
}

export function checkWorries(worries: PainPoint[], f: WorryFacts): WorryCheck[] {
  return worries.map((w) => checkWorry(w, f));
}

/** Facts for the swipe deck and card details, from the buyer's profile and money. */
export function factsForUnit(
  unit: Unit,
  o: {
    savingsRM: number | null;
    firstHome: boolean | null;
    netRM: number | null;
    commitmentsRM: number;
    maxPriceRM: number | null;
    tenureYears?: number;
    rate?: number;
    commuteHoursWeek: number | null;
    commuteFar: boolean;
    workName: string | null;
    places: string[];
    bedsNeeded: number;
    year: number;
  },
): WorryFacts {
  const t = townshipById[unit.townshipId]!;
  const c = costOfUnit(unit.priceRM, o.netRM ?? 0, o.commitmentsRM);
  const maint = maintenanceOf(unit);
  const st = nearestStation(t.pos);
  const avg = typeAveragePsf(unit.type).avg;
  const psf = unit.builtUpSqft > 0 ? unit.priceRM / unit.builtUpSqft : 0;
  return {
    unit,
    township: t,
    upfrontRM: Math.round(c.upfront),
    savingsRM: o.savingsRM,
    firstHome: o.firstHome,
    instalmentRM: monthlyInstalment(c.loan, o.rate ?? LOAN_RATE, o.tenureYears ?? LOAN_YEARS),
    netRM: o.netRM,
    commitmentsRM: o.commitmentsRM,
    maxPriceRM: o.maxPriceRM,
    maintenanceRM: maint.rm,
    maintenanceNote: maint.note,
    commuteHoursWeek: o.commuteHoursWeek,
    commuteFar: o.commuteFar,
    workName: o.workName,
    stationKm: st.km,
    stationName: st.station.name,
    waitYears: Math.max(unit.completion - o.year, 0),
    year: o.year,
    psfVsType: avg > 0 ? (psf - avg) / avg : 0,
    places: o.places,
    bedsShort: Math.max(o.bedsNeeded - unit.beds, 0),
    bedsSpare: Math.max(unit.beds - o.bedsNeeded, 0),
  };
}

/** Facts for Battle, from the head-to-head analysis (same numbers as the table). */
export function factsFromAnalysis(a: HomeAnalysis, ctx: BattleContext): WorryFacts {
  const m = ctx.money;
  const days = ctx.officeDays ?? 5;
  return {
    unit: a.unit,
    township: a.township,
    upfrontRM: a.upfrontRM,
    savingsRM: m.savingsRM,
    firstHome: m.firstHome,
    instalmentRM: a.instalmentRM,
    netRM: m.source !== "missing" && m.netRM > 0 ? m.netRM : null,
    commitmentsRM: m.commitmentsRM,
    maxPriceRM: m.maxPriceRM > 0 ? m.maxPriceRM : null,
    maintenanceRM: a.maintenanceRM,
    maintenanceNote: a.maintenanceNote,
    commuteHoursWeek: a.you.compared ? (a.you.oneWayMin * 2 * days) / 60 : null,
    commuteFar: !a.you.compared && !a.you.missing && Boolean(a.you.anchor),
    workName: ctx.workLabel,
    stationKm: a.stationKm,
    stationName: a.stationName,
    waitYears: a.waitYears,
    year: ctx.year,
    psfVsType: a.psfVsType,
    places: ctx.places,
    bedsShort: a.bedsShort,
    bedsSpare: a.bedsSpare,
  };
}

/** Places the buyer wants to be near (areas they like and must-be-near spots), for near_family. */
export function placesOf(p: Profile): string[] {
  return [...(p.preferredAreas ?? []), ...(p.mustBeNear ?? [])];
}
