import { eligibility, tenureYears, MAX_TENURE } from "./bank";
import {
  affordability,
  anchorOptions,
  samplePayslip,
  type Anchor,
} from "./data";
import { toIncomeInput, type Profile } from "./profile";
import { anchorFor, bedroomsNeeded } from "./recommend";
import type { Budget } from "./store";

/**
 * Who is buying, for the Battle screen. Everything comes from what Uncle heard (the profile)
 * and the bank check; whatever is missing falls back to a labelled default so the screen
 * always works: 5 office days, KL Sentral, the sample payslip.
 */

export type CommuteMode = "car" | "train" | "fastest";

export type MoneySource = "bank" | "profile" | "sample";

export type BuyerMoney = {
  source: MoneySource;
  /** Monthly take-home the bank counts (joint and other income included). */
  netRM: number;
  /** Monthly debt payments before this home loan. */
  commitmentsRM: number;
  /** Rough ceiling on the price the bank may lend against at 60% DSR. */
  maxPriceRM: number;
  /** Loan tenure from age (to 70, max 35 years). */
  tenureYears: number;
  tenureFromAge: boolean;
  /** Savings for the down payment and fees; null when the buyer has not said. */
  savingsRM: number | null;
  /** True / false when known; null when unknown. */
  firstHome: boolean | null;
};

export type BattleContext = {
  hasProfile: boolean;
  /** Plain labels for every default we filled in, shown on screen. */
  defaults: string[];
  work: Anchor;
  /** What the buyer said ("Mid Valley"), or the anchor name. */
  workLabel: string;
  workSource: "profile" | "picked" | "default";
  partner: Anchor | null;
  partnerLabel: string | null;
  officeDays: number;
  mode: CommuteMode;
  modeSource: "profile" | "picked" | "default";
  bedsNeeded: number;
  homeType: "landed" | "high_rise" | "either";
  hasKids: boolean;
  parentsMovingIn: boolean;
  pets: boolean | null;
  schoolMatters: boolean;
  schoolMaxKm: number;
  schoolTransport: Profile["schoolTransport"] | null;
  underConstructionOk: boolean | null;
  mustHaves: string[];
  dealBreakers: string[];
  mustBeNear: string[];
  money: BuyerMoney;
  year: number;
};

export type ContextOverrides = {
  workId?: string | null;
  officeDays?: number | null;
  mode?: CommuteMode | null;
};

export const DEFAULT_WORK_ID = "kl-sentral";
export const DEFAULT_OFFICE_DAYS = 5;
export const DEFAULT_SCHOOL_KM = 5;

const meaningful = (p: Profile) =>
  Object.values(p).some(
    (v) =>
      v !== undefined &&
      v !== null &&
      v !== "" &&
      !(Array.isArray(v) && v.length === 0),
  );

export function battleContext(
  s: { profile: Profile; budget: Budget | null },
  o: ContextOverrides = {},
  year = new Date().getFullYear(),
): BattleContext {
  const p = s.profile ?? {};
  const hasProfile = meaningful(p);
  const defaults: string[] = [];

  // Workplace: picked on this screen > what Uncle heard > KL Sentral.
  const picked = o.workId
    ? anchorOptions.find((a) => a.id === o.workId)
    : undefined;
  const heard = anchorFor(p.workArea);
  const fallback =
    anchorOptions.find((a) => a.id === DEFAULT_WORK_ID) ?? anchorOptions[0]!;
  const work = picked ?? heard ?? fallback;
  const workSource = picked ? "picked" : heard ? "profile" : "default";
  if (workSource === "default")
    defaults.push(
      p.workArea
        ? `Work: "${p.workArea}" is not on our map yet, so KL Sentral`
        : "Work: KL Sentral",
    );

  const partner = anchorFor(p.partnerWorkArea);

  const officeDays = o.officeDays ?? p.officeDays ?? DEFAULT_OFFICE_DAYS;
  if (o.officeDays == null && p.officeDays === undefined)
    defaults.push("5 office days a week");

  const fromProfile: CommuteMode | null =
    p.commuteMode === "car"
      ? "car"
      : p.commuteMode === "train"
        ? "train"
        : p.commuteMode === "mixed"
          ? "fastest"
          : null;
  const mode = o.mode ?? fromProfile ?? "car";
  const modeSource = o.mode ? "picked" : fromProfile ? "profile" : "default";
  if (modeSource === "default") defaults.push("Driving to work");

  // Money: the bank check if run, else Uncle's numbers, else the sample payslip.
  const input = toIncomeInput(p);
  const elig = input ? eligibility(input) : null;
  const tenureFromAge = p.age !== undefined;
  const tenure = tenureFromAge ? tenureYears(p.age!) : MAX_TENURE;
  let money: BuyerMoney;
  if (s.budget && s.budget.netRM > 0) {
    money = {
      source: "bank",
      netRM: s.budget.netRM,
      commitmentsRM: s.budget.commitmentsRM,
      maxPriceRM: s.budget.maxPriceRM,
      tenureYears: tenure,
      tenureFromAge,
      savingsRM: p.savingsRM ?? null,
      firstHome: p.firstHome ?? null,
    };
  } else if (elig && elig.netRM > 0) {
    money = {
      source: "profile",
      netRM: elig.netRM,
      commitmentsRM: elig.commitmentsRM,
      maxPriceRM: elig.maxPriceRM,
      tenureYears: elig.tenureYears,
      tenureFromAge: true,
      savingsRM: p.savingsRM ?? null,
      firstHome: p.firstHome ?? null,
    };
  } else {
    const a = affordability(samplePayslip);
    money = {
      source: "sample",
      netRM: a.netRM,
      commitmentsRM: a.commitmentsRM,
      maxPriceRM: a.maxPriceRM,
      tenureYears: tenure,
      tenureFromAge,
      savingsRM: p.savingsRM ?? null,
      firstHome: p.firstHome ?? null,
    };
    defaults.push("Sample payslip (RM9,800 gross)");
  }
  if (!tenureFromAge) defaults.push("35-year loan (tell Uncle your age)");

  const hasKids =
    (p.kidsNow ?? 0) > 0 ||
    p.kidsPlanned === "yes" ||
    p.livingWith === "partner_kids";

  return {
    hasProfile,
    defaults,
    work,
    workLabel: workSource === "profile" && p.workArea ? p.workArea : work.name,
    workSource,
    partner,
    partnerLabel: partner ? (p.partnerWorkArea ?? partner.name) : null,
    officeDays,
    mode,
    modeSource,
    bedsNeeded: bedroomsNeeded(p),
    homeType: p.homeType ?? "either",
    hasKids,
    parentsMovingIn: p.parentsMovingIn ?? false,
    pets: p.pets ?? null,
    schoolMatters: p.schoolMatters ?? false,
    schoolMaxKm: p.schoolMaxKm ?? DEFAULT_SCHOOL_KM,
    schoolTransport: p.schoolTransport ?? null,
    underConstructionOk: p.underConstructionOk ?? null,
    mustHaves: p.mustHaves ?? [],
    dealBreakers: p.dealBreakers ?? [],
    mustBeNear: p.mustBeNear ?? [],
    money,
    year,
  };
}

/** The Budget shape recommend.ts expects, so match scores agree with the swipe deck. */
export function budgetForMatch(
  ctx: BattleContext,
  budget: Budget | null,
): Budget | null {
  if (budget) return budget;
  if (ctx.money.source === "sample") return null;
  return {
    grossRM: 0,
    netRM: ctx.money.netRM,
    commitmentsRM: ctx.money.commitmentsRM,
    maxLoanRM: ctx.money.maxPriceRM * 0.9,
    maxPriceRM: ctx.money.maxPriceRM,
  };
}
