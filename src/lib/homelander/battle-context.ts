import { eligibility, tenureYears, MAX_TENURE } from "./bank";
import { anchorOptions, type Anchor } from "./data";
import { toIncomeInput, type Profile } from "./profile";
import { anchorFor, bedroomsNeeded } from "./recommend";
import type { Budget } from "./store";

/**
 * Who is buying, for the Battle screen. Everything comes from what Uncle heard (the profile),
 * the bank check, or what the buyer picks on this screen. Nothing is invented: when an input is
 * missing it stays missing (null), and the screen says so ("Tell Uncle where you work") and
 * leaves that category out of the fight instead of guessing.
 */

export type CommuteMode = "car" | "train" | "fastest";

export type MoneySource = "bank" | "profile" | "missing";

export type BuyerMoney = {
  source: MoneySource;
  /** Monthly take-home the bank counts (joint and other income included). 0 when missing. */
  netRM: number;
  /** Monthly debt payments before this home loan. */
  commitmentsRM: number;
  /** Rough ceiling on the price the bank may lend against at 60% DSR. 0 when missing. */
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
  /** Uncle has heard at least one answer. */
  hasProfile: boolean;
  /** The buyer finished onboarding (or at least has a profile we can battle on). */
  onboarded: boolean;
  /** Plain labels for every input Uncle doesn't have yet, shown on screen. */
  missing: string[];
  /** Null until the buyer tells Uncle (or picks here) where they work. */
  work: Anchor | null;
  /** What the buyer said ("Mid Valley"), or the anchor name. */
  workLabel: string | null;
  workSource: "profile" | "picked" | "missing";
  /** A workplace the buyer named that is not on our commute map. */
  workUnmapped: string | null;
  partner: Anchor | null;
  partnerLabel: string | null;
  officeDays: number | null;
  mode: CommuteMode | null;
  modeSource: "profile" | "picked" | "missing";
  /** Why commute can't be compared (no workplace, office days or mode), or null when it can. */
  commuteMissing: string | null;
  bedsNeeded: number;
  homeType: "landed" | "high_rise" | "either";
  hasKids: boolean;
  parentsMovingIn: boolean;
  pets: boolean | null;
  schoolMatters: boolean;
  /** The distance the buyer said is OK; null when they haven't said. */
  schoolMaxKm: number | null;
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

const meaningful = (p: Profile) =>
  Object.values(p).some(
    (v) =>
      v !== undefined &&
      v !== null &&
      v !== "" &&
      !(Array.isArray(v) && v.length === 0),
  );

export function battleContext(
  s: { profile: Profile; budget: Budget | null; onboardedAt?: string | null },
  o: ContextOverrides = {},
  year = new Date().getFullYear(),
): BattleContext {
  const p = s.profile ?? {};
  const hasProfile = meaningful(p);
  const missing: string[] = [];

  // Workplace: picked on this screen > what Uncle heard > nothing.
  const picked = o.workId
    ? anchorOptions.find((a) => a.id === o.workId)
    : undefined;
  const heard = anchorFor(p.workArea);
  const work = picked ?? heard ?? null;
  const workSource = picked ? "picked" : heard ? "profile" : "missing";
  const workUnmapped = !work && p.workArea ? p.workArea : null;
  if (!work)
    missing.push(
      workUnmapped
        ? `Work: "${workUnmapped}" isn't on our commute map yet`
        : "Where you work",
    );

  const partner = anchorFor(p.partnerWorkArea);

  const officeDays = o.officeDays ?? p.officeDays ?? null;
  if (officeDays === null) missing.push("Office days a week");

  const fromProfile: CommuteMode | null =
    p.commuteMode === "car"
      ? "car"
      : p.commuteMode === "train"
        ? "train"
        : p.commuteMode === "mixed"
          ? "fastest"
          : null;
  const mode = o.mode ?? fromProfile ?? null;
  const modeSource = o.mode ? "picked" : fromProfile ? "profile" : "missing";
  if (mode === null) missing.push("Car or train");

  const commuteMissing = !work
    ? workUnmapped
      ? `"${workUnmapped}" isn't on our commute map. Pick the closest place you work`
      : "Tell Uncle where you work"
    : officeDays === null
      ? "Tell Uncle your office days"
      : mode === null
        ? "Tell Uncle car or train"
        : null;

  // Money: the bank check if run, else Uncle's numbers, else missing (no sample payslip).
  const input = toIncomeInput(p);
  const elig = input ? eligibility(input) : null;
  const tenureFromAge = p.age !== undefined;
  const tenure = tenureFromAge ? tenureYears(p.age!) : MAX_TENURE;
  const savingsRM = p.savingsRM ?? null;
  const firstHome = p.firstHome ?? null;
  let money: BuyerMoney;
  if (s.budget && s.budget.netRM > 0) {
    money = {
      source: "bank",
      netRM: s.budget.netRM,
      commitmentsRM: s.budget.commitmentsRM,
      maxPriceRM: s.budget.maxPriceRM,
      tenureYears: tenure,
      tenureFromAge,
      savingsRM,
      firstHome,
    };
  } else if (elig && elig.netRM > 0) {
    money = {
      source: "profile",
      netRM: elig.netRM,
      commitmentsRM: elig.commitmentsRM,
      maxPriceRM: elig.maxPriceRM,
      tenureYears: elig.tenureYears,
      tenureFromAge: true,
      savingsRM,
      firstHome,
    };
  } else {
    money = {
      source: "missing",
      netRM: 0,
      commitmentsRM: 0,
      maxPriceRM: 0,
      tenureYears: tenure,
      tenureFromAge,
      savingsRM,
      firstHome,
    };
    missing.push(
      p.grossRM === undefined
        ? "Your monthly salary"
        : "Your age (for the bank's sums)",
    );
  }
  if (savingsRM === null) missing.push("Savings for the down payment");
  if (!tenureFromAge && money.source !== "missing")
    missing.push("Your age (loan uses the 35-year maximum until then)");

  const hasKids =
    (p.kidsNow ?? 0) > 0 ||
    p.kidsPlanned === "yes" ||
    p.livingWith === "partner_kids";

  return {
    hasProfile,
    onboarded: Boolean(s.onboardedAt) && hasProfile,
    missing,
    work,
    workLabel: work
      ? workSource === "profile" && p.workArea
        ? p.workArea
        : work.name
      : null,
    workSource,
    workUnmapped,
    partner,
    partnerLabel: partner ? (p.partnerWorkArea ?? partner.name) : null,
    officeDays,
    mode,
    modeSource,
    commuteMissing,
    bedsNeeded: bedroomsNeeded(p),
    homeType: p.homeType ?? "either",
    hasKids,
    parentsMovingIn: p.parentsMovingIn ?? false,
    pets: p.pets ?? null,
    schoolMatters: p.schoolMatters ?? false,
    schoolMaxKm: p.schoolMaxKm ?? null,
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
  if (ctx.money.source === "missing") return null;
  return {
    grossRM: 0,
    netRM: ctx.money.netRM,
    commitmentsRM: ctx.money.commitmentsRM,
    maxLoanRM: ctx.money.maxPriceRM * 0.9,
    maxPriceRM: ctx.money.maxPriceRM,
  };
}
