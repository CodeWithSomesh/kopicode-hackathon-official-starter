import { eligibility, MIN_TENURE } from "@/lib/homelander/bank";
import { commuteCost, type CommuteCost } from "@/lib/homelander/commute-cost";
import {
  affordability,
  costOfUnit,
  distanceKm,
  LOAN_RATE,
  LOAN_YEARS,
  monthlyInstalment,
  rm,
  samplePayslip,
  townshipById,
  type Anchor,
  type Unit,
} from "@/lib/homelander/data";
import { toIncomeInput, type Profile } from "@/lib/homelander/profile";
import { bedroomsNeeded } from "@/lib/homelander/recommend";
import { nearestByType, schoolTypeLabel, type NearbySchool, type SchoolType } from "@/lib/homelander/schools";
import type { Budget } from "@/lib/homelander/store";

/**
 * Everything the "More details" side of a card says, worked out for THIS buyer: their income
 * (from Uncle, else the bank check, else a labelled sample payslip), their workplace and office
 * days, their household and school limits. Pure functions, so the card stays a view.
 */

export type MoneyBasis = {
  netRM: number;
  commitmentsRM: number;
  tenureYears: number;
  rate: number;
  savingsRM?: number;
  source: "uncle" | "bank" | "sample";
  note: string;
};

export function moneyBasis(profile: Profile, budget: Budget | null): MoneyBasis {
  const input = toIncomeInput(profile);
  if (input) {
    const e = eligibility(input);
    const tenure = e.tenureYears >= MIN_TENURE ? e.tenureYears : LOAN_YEARS;
    return {
      netRM: e.netRM,
      commitmentsRM: e.commitmentsRM,
      tenureYears: tenure,
      rate: e.rate,
      savingsRM: profile.savingsRM,
      source: "uncle",
      note: `From what you told Uncle: ${rm(e.netRM)} take-home${e.takeHomeEstimated ? " (estimated)" : ""}, ${tenure}-year loan.`,
    };
  }
  if (budget) {
    return {
      netRM: budget.netRM,
      commitmentsRM: budget.commitmentsRM,
      tenureYears: LOAN_YEARS,
      rate: LOAN_RATE,
      savingsRM: profile.savingsRM,
      source: "bank",
      note: `From your bank check: ${rm(budget.netRM)} take-home.`,
    };
  }
  const a = affordability(samplePayslip);
  return {
    netRM: a.netRM,
    commitmentsRM: a.commitmentsRM,
    tenureYears: LOAN_YEARS,
    rate: LOAN_RATE,
    source: "sample",
    note: `Sample payslip (${rm(samplePayslip.grossRM)} gross). Sit with Uncle for your own numbers.`,
  };
}

export type CommuteMode = "car" | "train";

export type HomeDetails = {
  money: {
    instalmentRM: number;
    loanRM: number;
    downPaymentRM: number;
    stampDutyRM: number;
    loanStampRM: number;
    legalRM: number;
    upfrontRM: number;
    /** Monthly maintenance / service charge, or null when not published. */
    upkeepRM: number | null;
    upkeepHow: string | null;
    commuteRM: number;
    /** Instalment + upkeep + commute. */
    totalMonthlyRM: number;
    /** Take-home after commitments and the total above. */
    leftRM: number;
    savingsGapRM: number | null;
    psfRM: number;
  };
  commute: {
    anchor: Anchor;
    cost: CommuteCost;
    mode: CommuteMode;
    modeAssumed: boolean;
    officeDays: number;
    far: boolean;
    straightKm: number;
  };
  family: {
    need: number | null;
    beds: number;
    schools: { type: SchoolType; label: string; school: NearbySchool; tooFar: boolean }[];
    schoolLimitKm: number | null;
  };
  completion: { year: number; cantWait: boolean };
};

const THIS_YEAR = 2026;
/** Beyond this, a daily drive to a Klang Valley office isn't a commute any more. */
const FAR_KM = 90;

const knowsHousehold = (p: Profile) =>
  p.minBedrooms !== undefined || p.livingWith !== undefined || p.kidsPlanned !== undefined || p.kidsNow !== undefined;

export function homeDetails(unit: Unit, profile: Profile, basis: MoneyBasis, anchor: Anchor): HomeDetails {
  const t = townshipById[unit.townshipId]!;
  const officeDays = profile.officeDays ?? 5;
  const cost = commuteCost(t.pos, anchor, officeDays);
  const mode: CommuteMode =
    profile.commuteMode === "train"
      ? "train"
      : profile.commuteMode === "car"
        ? "car"
        : cost.train.totalRM < cost.car.totalRM && cost.trainMinOneWay <= cost.driveMinPeak + 10
          ? "train"
          : "car";
  const straightKm = distanceKm(t.pos, anchor.pos);
  const far = (t.region !== undefined && t.region !== "klang-valley") || straightKm > FAR_KM;

  const c = costOfUnit(unit.priceRM, basis.netRM, basis.commitmentsRM);
  const instalmentRM = Math.round(monthlyInstalment(c.loan, basis.rate, basis.tenureYears));
  const upkeepRM =
    unit.maintenancePsfRM !== undefined
      ? Math.round(unit.maintenancePsfRM * unit.builtUpSqft)
      : unit.serviceRM !== undefined
        ? unit.serviceRM
        : null;
  const upkeepHow =
    unit.maintenancePsfRM !== undefined
      ? `RM${unit.maintenancePsfRM.toFixed(2)} psf maintenance`
      : unit.serviceRM !== undefined
        ? "Guard and service fee"
        : null;
  // A daily commute from Johor or Sabah isn't a monthly cost, it's a move: leave it out of the total.
  const commuteRM = far ? 0 : mode === "train" ? cost.train.totalRM : cost.car.totalRM;
  const totalMonthlyRM = instalmentRM + (upkeepRM ?? 0) + commuteRM;
  const upfrontRM = Math.round(c.upfront);

  const limit = profile.schoolMatters ? (profile.schoolMaxKm ?? 5) : null;
  const near = nearestByType(t.pos);
  const schools = (Object.keys(schoolTypeLabel) as SchoolType[])
    .filter((k) => near[k])
    .map((k) => ({
      type: k,
      label: schoolTypeLabel[k],
      school: near[k]!,
      tooFar: limit !== null && near[k]!.km > limit,
    }));

  return {
    money: {
      instalmentRM,
      loanRM: Math.round(c.loan),
      downPaymentRM: Math.round(c.downPayment),
      stampDutyRM: c.stampDuty,
      loanStampRM: c.loanStamp,
      legalRM: c.legal,
      upfrontRM,
      upkeepRM,
      upkeepHow,
      commuteRM,
      totalMonthlyRM,
      leftRM: Math.round(basis.netRM - basis.commitmentsRM - totalMonthlyRM),
      savingsGapRM: basis.savingsRM !== undefined ? Math.round(upfrontRM - basis.savingsRM) : null,
      psfRM: Math.round(unit.priceRM / unit.builtUpSqft),
    },
    commute: { anchor, cost, mode, modeAssumed: !profile.commuteMode || profile.commuteMode === "mixed", officeDays, far, straightKm },
    family: {
      need: knowsHousehold(profile) ? bedroomsNeeded(profile) : null,
      beds: unit.beds,
      schools,
      schoolLimitKm: limit,
    },
    completion: { year: unit.completion, cantWait: profile.underConstructionOk === false && unit.completion > THIS_YEAR },
  };
}
