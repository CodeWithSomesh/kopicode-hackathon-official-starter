/**
 * HomeLander bank check: what a Malaysian bank is likely to lend for a first home.
 * Every figure here is a SAMPLE estimate for the demo. The per-bank ceilings and
 * rates are sample assumptions, not any bank's published criteria. Real banks
 * also check CCRIS and CTOS, payslip history and the property itself.
 */

import { DSR_LIMIT, LOAN_RATE, MARGIN, loanFromInstalment, monthlyInstalment } from "./data";

/* ---------------------------------------------------------------- inputs */

export type Commitments = {
  carRM: number;
  ptptnRM: number;
  personalRM: number;
  /** Outstanding credit card balance; banks count a minimum payment of 5% a month. */
  cardBalanceRM: number;
  /** Instalment on any other housing loan. */
  housingRM: number;
};

export type IncomeInput = {
  grossRM: number;
  /** Fixed allowances or rental income, per month. */
  otherIncomeRM: number;
  joint: boolean;
  jointGrossRM: number;
  /** Take-home the buyer typed (or read from a payslip). Null: we estimate it from gross. */
  takeHomeRM: number | null;
  age: number;
  commitments: Commitments;
};

/* ---------------------------------------------------------------- assumptions */

export const EPF_RATE = 0.11;
/** SOCSO (0.5%) + EIS (0.2%) employee share, on wages up to the RM6,000 ceiling. */
export const SOCSO_EIS_RATE = 0.007;
export const SOCSO_WAGE_CEILING = 6_000;
export const CARD_MIN_RATE = 0.05;
/** Sample: banks often count only part of allowances and rental. */
export const OTHER_INCOME_COUNTED = 0.8;
/** The headline uses the common 60% DSR; some banks go to 70% for higher earners. */
export const HEADLINE_DSR = DSR_LIMIT;
export const HIGH_DSR = 0.7;
export const MAX_TENURE = 35;
export const LOAN_END_AGE = 70;
export const MIN_TENURE = 5;
export const STRETCH = 0.1;

/* ---------------------------------------------------------------- take-home estimate */

/** Resident income tax bands (chargeable income, rate). Rough, for a PCB estimate only. */
const TAX_BANDS: [number, number][] = [
  [5_000, 0],
  [15_000, 0.01],
  [15_000, 0.03],
  [15_000, 0.06],
  [20_000, 0.11],
  [30_000, 0.19],
  [300_000, 0.25],
  [200_000, 0.26],
  [1_400_000, 0.28],
  [Infinity, 0.3],
];

/** Rough monthly PCB: individual relief RM9,000, EPF relief up to RM4,000, RM400 rebate under RM35k. */
export function pcbEstimate(grossRM: number) {
  const annual = grossRM * 12;
  const epfRelief = Math.min(annual * EPF_RATE, 4_000);
  let left = Math.max(annual - 9_000 - epfRelief, 0);
  const chargeable = left;
  let tax = 0;
  for (const [band, rate] of TAX_BANDS) {
    const part = Math.min(left, band);
    tax += part * rate;
    left -= part;
    if (left <= 0) break;
  }
  if (chargeable <= 35_000) tax = Math.max(tax - 400, 0);
  return Math.round(tax / 12);
}

export function takeHomeEstimate(grossRM: number) {
  const epfRM = Math.round(grossRM * EPF_RATE);
  const socsoRM = Math.round(Math.min(grossRM, SOCSO_WAGE_CEILING) * SOCSO_EIS_RATE);
  const pcbRM = pcbEstimate(grossRM);
  return { epfRM, socsoRM, pcbRM, netRM: Math.max(grossRM - epfRM - socsoRM - pcbRM, 0) };
}

/* ---------------------------------------------------------------- the check */

export function tenureYears(age: number) {
  return Math.max(Math.min(MAX_TENURE, LOAN_END_AGE - age), 0);
}

export function cardMinimum(balanceRM: number) {
  return Math.round(balanceRM * CARD_MIN_RATE);
}

export function monthlyCommitments(c: Commitments) {
  return c.carRM + c.ptptnRM + c.personalRM + cardMinimum(c.cardBalanceRM) + c.housingRM;
}

export type Eligibility = {
  grossRM: number;
  /** Main applicant's take-home: typed, or estimated. */
  mainNetRM: number;
  takeHomeEstimated: boolean;
  mainBreakdown: ReturnType<typeof takeHomeEstimate>;
  jointNetRM: number;
  otherCountedRM: number;
  netRM: number;
  commitmentsRM: number;
  /** Commitments as a share of take-home, before any home loan. */
  dsrNow: number;
  tenureYears: number;
  rate: number;
  dsr: number;
  maxInstalmentRM: number;
  maxLoanRM: number;
  maxPriceRM: number;
};

export function eligibility(input: IncomeInput, dsr = HEADLINE_DSR, rate = LOAN_RATE): Eligibility {
  const mainBreakdown = takeHomeEstimate(input.grossRM);
  const takeHomeEstimated = input.takeHomeRM === null;
  const mainNetRM = input.takeHomeRM ?? mainBreakdown.netRM;
  const jointNetRM = input.joint ? takeHomeEstimate(input.jointGrossRM).netRM : 0;
  const otherCountedRM = Math.round(input.otherIncomeRM * OTHER_INCOME_COUNTED);
  const netRM = mainNetRM + jointNetRM + otherCountedRM;
  const grossRM = input.grossRM + (input.joint ? input.jointGrossRM : 0) + input.otherIncomeRM;
  const commitmentsRM = monthlyCommitments(input.commitments);
  const tenure = tenureYears(input.age);
  const maxInstalmentRM = tenure >= MIN_TENURE ? Math.max(netRM * dsr - commitmentsRM, 0) : 0;
  const maxLoanRM = Math.floor(loanFromInstalment(maxInstalmentRM, rate, tenure || 1) / 1_000) * 1_000;
  const maxPriceRM = Math.floor(maxLoanRM / MARGIN / 10_000) * 10_000;
  return {
    grossRM,
    mainNetRM,
    takeHomeEstimated,
    mainBreakdown,
    jointNetRM,
    otherCountedRM,
    netRM,
    commitmentsRM,
    dsrNow: netRM > 0 ? commitmentsRM / netRM : 1,
    tenureYears: tenure,
    rate,
    dsr,
    maxInstalmentRM,
    maxLoanRM,
    maxPriceRM,
  };
}

/** Monthly debt you would need to clear to get back under the headline DSR. */
export function debtToClear(e: Eligibility) {
  return Math.max(Math.ceil(e.commitmentsRM - e.netRM * e.dsr), 0);
}

/* ---------------------------------------------------------------- homes */

export type HomeStatus = "in" | "stretch" | "out";

export function homeFit(priceRM: number, e: Eligibility) {
  const loanRM = priceRM * MARGIN;
  const instalmentRM = monthlyInstalment(loanRM, e.rate, Math.max(e.tenureYears, 1));
  const leftRM = e.netRM - e.commitmentsRM - instalmentRM;
  const status: HomeStatus =
    e.maxPriceRM > 0 && priceRM <= e.maxPriceRM
      ? "in"
      : e.maxPriceRM > 0 && priceRM <= e.maxPriceRM * (1 + STRETCH)
        ? "stretch"
        : "out";
  return { loanRM, instalmentRM, leftRM, status };
}

/* ---------------------------------------------------------------- five banks (sample) */

export type SampleBank = {
  id: string;
  name: string;
  /** Sample rate, not a quote. */
  rate: number;
  /** Sample DSR ceiling by monthly take-home band: under RM3k, RM3k to 8k, RM8k and up. */
  ceilings: [number, number, number];
};

export const INCOME_BANDS = [3_000, 8_000] as const;

export const sampleBanks: SampleBank[] = [
  { id: "maybank", name: "Maybank", rate: 0.0415, ceilings: [0.6, 0.65, 0.7] },
  { id: "cimb", name: "CIMB", rate: 0.042, ceilings: [0.55, 0.65, 0.7] },
  { id: "pbb", name: "Public Bank", rate: 0.041, ceilings: [0.6, 0.6, 0.65] },
  { id: "rhb", name: "RHB", rate: 0.0425, ceilings: [0.6, 0.7, 0.75] },
  { id: "hlb", name: "Hong Leong", rate: 0.042, ceilings: [0.6, 0.65, 0.75] },
];

export function incomeBand(netRM: number) {
  return netRM < INCOME_BANDS[0] ? 0 : netRM < INCOME_BANDS[1] ? 1 : 2;
}

export type BankVerdict = "yes" | "maybe" | "no";

/**
 * Per-bank estimate for one home. Yes: the home loan keeps DSR at least 5 points under that
 * bank's sample ceiling. Maybe: within the last 5 points. No: over the ceiling, or tenure too short.
 */
export function bankEstimates(input: IncomeInput, targetPriceRM: number) {
  return sampleBanks.map((bank) => {
    const base = eligibility(input, HEADLINE_DSR, bank.rate);
    const ceiling = bank.ceilings[incomeBand(base.netRM)];
    const e = eligibility(input, ceiling, bank.rate);
    const loanRM = targetPriceRM * MARGIN;
    const instalmentRM = e.tenureYears >= MIN_TENURE ? monthlyInstalment(loanRM, bank.rate, e.tenureYears) : Infinity;
    const dsrWithHome = e.netRM > 0 ? (e.commitmentsRM + instalmentRM) / e.netRM : Infinity;
    const verdict: BankVerdict =
      dsrWithHome <= ceiling - 0.05 ? "yes" : dsrWithHome <= ceiling ? "maybe" : "no";
    return { bank, ceiling, maxLoanRM: e.maxLoanRM, instalmentRM, dsrWithHome, verdict };
  });
}

/* ---------------------------------------------------------------- form parsing + validation */

export type FormValues = {
  gross: string;
  other: string;
  joint: boolean;
  jointGross: string;
  takeHome: string;
  age: string;
  car: string;
  ptptn: string;
  personal: string;
  card: string;
  housing: string;
};

export type FieldKey = Exclude<keyof FormValues, "joint">;

export const emptyForm: FormValues = {
  gross: "",
  other: "",
  joint: false,
  jointGross: "",
  takeHome: "",
  age: "",
  car: "",
  ptptn: "",
  personal: "",
  card: "",
  housing: "",
};

/** "9,800" -> 9800; "" -> null; anything else that isn't a plain amount -> NaN. */
export function parseRM(raw: string): number | null {
  const s = raw.replace(/[,\s]/g, "").replace(/^RM/i, "");
  if (s === "") return null;
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
}

const amountError = (label: string) => `${label} should be a plain amount in ringgit, like 1,250. Remove letters or symbols.`;

export function validate(v: FormValues): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  const gross = parseRM(v.gross);
  if (gross === null || gross === 0)
    errors.gross = "Enter your monthly gross salary, the amount before EPF and tax. Or scan the sample payslip to try it.";
  else if (Number.isNaN(gross)) errors.gross = amountError("Gross salary");
  else if (gross < 500) errors.gross = `RM${gross} looks low for a month. Enter your monthly salary, not a daily or weekly rate.`;
  else if (gross > 300_000) errors.gross = "That is over RM300,000 a month. Check for an extra zero.";

  if (v.joint) {
    const jg = parseRM(v.jointGross);
    if (jg === null || jg === 0)
      errors.jointGross = "Enter your joint applicant's monthly gross salary, or switch joint applicant off.";
    else if (Number.isNaN(jg)) errors.jointGross = amountError("Their gross salary");
    else if (jg > 300_000) errors.jointGross = "That is over RM300,000 a month. Check for an extra zero.";
  }

  const th = parseRM(v.takeHome);
  if (th !== null) {
    if (Number.isNaN(th)) errors.takeHome = amountError("Take-home");
    else if (gross !== null && !Number.isNaN(gross) && th > gross)
      errors.takeHome = "Take-home can't be more than your gross salary. Fix it, or clear it and we'll estimate it.";
  }

  const age = v.age.trim() === "" ? null : Number(v.age);
  if (age === null) errors.age = "Enter your age in years. It sets how long the loan can run.";
  else if (!Number.isInteger(age) || age < 18) errors.age = "Enter your age as a whole number, 18 or older.";
  else if (age > LOAN_END_AGE - MIN_TENURE)
    errors.age = `At ${age} the loan must end by ${LOAN_END_AGE}, so under ${MIN_TENURE} years. Ask a younger joint applicant to be the main borrower.`;

  const money: [FieldKey, string][] = [
    ["other", "Other income"],
    ["car", "Car loan"],
    ["ptptn", "PTPTN"],
    ["personal", "Personal loan"],
    ["card", "Card balance"],
    ["housing", "Other housing loan"],
  ];
  for (const [k, label] of money) if (Number.isNaN(parseRM(v[k]))) errors[k] = amountError(label);
  return errors;
}

export function toInput(v: FormValues): IncomeInput {
  const n = (s: string) => {
    const x = parseRM(s);
    return x === null || Number.isNaN(x) ? 0 : x;
  };
  const th = parseRM(v.takeHome);
  return {
    grossRM: n(v.gross),
    otherIncomeRM: n(v.other),
    joint: v.joint,
    jointGrossRM: v.joint ? n(v.jointGross) : 0,
    takeHomeRM: th === null || Number.isNaN(th) ? null : th,
    age: Number(v.age) || 0,
    commitments: {
      carRM: n(v.car),
      ptptnRM: n(v.ptptn),
      personalRM: n(v.personal),
      cardBalanceRM: n(v.card),
      housingRM: n(v.housing),
    },
  };
}
