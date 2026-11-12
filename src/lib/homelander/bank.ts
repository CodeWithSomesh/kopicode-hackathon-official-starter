/**
 * HomeLander bank check: what a Malaysian bank is likely to lend for a home.
 * Every figure here is an ESTIMATE for the demo. The product list and listed rates come
 * from the MYHomeMath template (see banks-data.ts); the per-bank DSR caps are sample
 * assumptions, not any bank's published criteria. Real banks also check CCRIS and CTOS,
 * payslip history and the property itself.
 */

import {
  INCOME_BANDS,
  lenderById,
  lenders,
  products,
  type Citizenship,
  type Employment,
  type Lender,
  type LoanProduct,
  type RateTier,
} from "./banks-data";
import { DSR_LIMIT, LOAN_RATE, MARGIN, legalFees, loanFromInstalment, monthlyInstalment, transferStampDuty } from "./data";

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


/* ---------------------------------------------------------------- every bank (MYHomeMath template) */

export type { BankId, Citizenship, Employment, Lender, LoanProduct } from "./banks-data";
export { INCOME_BANDS, lenders, products } from "./banks-data";

/** How long in the current job or business. Banks want payslips, or two years of Form B. */
export type JobTenure = "lt6m" | "6to12m" | "1to2y" | "2y_plus";

/**
 * Share of the main applicant's income a bank is likely to count. Salaried pay counts in full;
 * self-employed income is averaged from Form B and commission from the last 6 months, and
 * banks usually discount both because it varies. Sample assumptions.
 */
export const INCOME_RECOGNISED: Record<Employment, number> = {
  salaried: 1,
  self_employed: 0.8,
  commission: 0.75,
};

/** BNM: up to 90% on a first or second housing loan; 70% from the third. */
export const STANDARD_MARGIN = MARGIN;
/** First-home schemes (SJKP, My First Home and youth schemes): up to 100% on homes up to RM500k. */
export const SCHEME_MARGIN = 1;
export const SCHEME_PRICE_CAP = 500_000;
/** i-MILIKI: first home up to RM500k pays no stamp duty on the transfer or the loan (SPAs to end-2027). */
export const STAMP_EXEMPT_PRICE_CAP = 500_000;
export const LOAN_STAMP_RATE = 0.005;
/** "Likely" needs this much room under the bank's DSR cap. */
export const DSR_BUFFER = 0.05;
/** Stress test: what the instalment looks like if rates rise this much. */
export const STRESS_RATE = 0.01;

export type BankCheckInput = {
  income: IncomeInput;
  employment: Employment;
  jobTenure: JobTenure;
  citizenship: Citizenship;
  firstHome: boolean;
  /** Null when the buyer hasn't said. */
  savingsRM: number | null;
  /** Loan tenure the buyer picked; null means the longest allowed. */
  tenureYears: number | null;
};

export type Counted = {
  /** The market check (60% DSR, sample rate) on the income a bank counts. */
  e: Eligibility;
  recognised: number;
  /** Monthly take-home a bank counts: main (after the employment discount) + joint + other. */
  netRM: number;
  /** Gross per year, both applicants and other income: what the minimum-income rules test. */
  annualGrossRM: number;
  maxTenureYears: number;
  tenureYears: number;
};

/** The income every bank works from, after the employment discount. */
export function counted(c: BankCheckInput): Counted {
  const recognised = INCOME_RECOGNISED[c.employment];
  const base = eligibility(c.income);
  const mainNetRM = Math.round(base.mainNetRM * recognised);
  const netRM = mainNetRM + base.jointNetRM + base.otherCountedRM;
  const maxTenureYears = base.tenureYears;
  const tenure =
    c.tenureYears === null ? maxTenureYears : Math.max(Math.min(c.tenureYears, maxTenureYears), Math.min(MIN_TENURE, maxTenureYears));
  // Re-run the market check on the counted income so Swipe and Battle see the same budget.
  const e = eligibility({
    ...c.income,
    grossRM: c.income.grossRM * recognised,
    takeHomeRM: mainNetRM,
  });
  return { e, recognised, netRM, annualGrossRM: base.grossRM * 12, maxTenureYears, tenureYears: tenure };
}

export function dsrCapFor(lender: Lender, netRM: number) {
  return lender.dsrCaps[incomeBand(netRM)];
}

export function incomeBand(netRM: number) {
  return netRM < INCOME_BANDS[0] ? 0 : netRM < INCOME_BANDS[1] ? 1 : 2;
}

/** Margin of finance for this product at this price. */
export function marginFor(product: LoanProduct, priceRM: number, firstHome: boolean) {
  return product.firstHomeScheme && firstHome && priceRM <= SCHEME_PRICE_CAP ? SCHEME_MARGIN : STANDARD_MARGIN;
}

export function tierFor(product: LoanProduct, loanRM: number): RateTier | null {
  return product.tiers.find((t) => loanRM >= t.minLoanRM && (t.maxLoanRM === null || loanRM <= t.maxLoanRM)) ?? null;
}

const productMaxLoan = (p: LoanProduct) =>
  p.tiers.some((t) => t.maxLoanRM === null) ? Infinity : Math.max(...p.tiers.map((t) => t.maxLoanRM ?? 0));
const productMinLoan = (p: LoanProduct) => Math.min(...p.tiers.map((t) => t.minLoanRM));

/** Cash needed on top of the loan: down payment, stamp duty (unless i-MILIKI applies) and legal fees. */
export function cashUpfront(priceRM: number, loanRM: number, firstHome: boolean) {
  const exempt = firstHome && priceRM <= STAMP_EXEMPT_PRICE_CAP;
  const downPaymentRM = Math.max(priceRM - loanRM, 0);
  const transferDutyRM = exempt ? 0 : transferStampDuty(priceRM);
  const loanDutyRM = exempt ? 0 : Math.round(loanRM * LOAN_STAMP_RATE);
  const legalRM = legalFees(priceRM);
  return {
    downPaymentRM,
    transferDutyRM,
    loanDutyRM,
    legalRM,
    exempt,
    totalRM: downPaymentRM + transferDutyRM + loanDutyRM + legalRM,
  };
}

export type Verdict = "likely" | "borderline" | "unlikely";

export type ProductResult = {
  product: LoanProduct;
  lender: Lender;
  dsrCap: number;
  tenureYears: number;
  /** Largest loan this product would give, on DSR and the product's loan range. */
  maxLoanRM: number;
  maxPriceRM: number;
  /** Rate on the target loan, or on the max loan when there's no target. */
  rate: number;
  /** Target home, when one is set. */
  target: null | {
    priceRM: number;
    margin: number;
    loanRM: number;
    instalmentRM: number;
    stressInstalmentRM: number;
    dsrWithHome: number;
    leftRM: number;
  };
  verdict: Verdict;
  /** Why it isn't "likely", most important first. Empty when likely. */
  reasons: string[];
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
/** One decimal, so a DSR just over or under a cap never reads "70%, over this bank's 70%". */
const pct1 = (x: number) => `${(x * 100).toFixed(1).replace(/\.0$/, "")}%`;
const rmK = (n: number) =>
  n >= 1_000_000 ? `RM${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M` : `RM${Math.round(n / 1000)}k`;

/** Check one product for this buyer and (optionally) a target price. */
export function checkProduct(product: LoanProduct, c: BankCheckInput, k: Counted, priceRM: number | null): ProductResult {
  const lender = lenderById[product.bankId];
  const dsrCap = dsrCapFor(lender, k.netRM);
  const commitmentsRM = monthlyCommitments(c.income.commitments);
  const tenure = k.tenureYears;
  const capacityRM = tenure >= MIN_TENURE ? Math.max(k.netRM * dsrCap - commitmentsRM, 0) : 0;

  // Largest loan: try each rate tier, keep what fits inside that tier.
  let maxLoanRM = 0;
  let maxRate = product.tiers[0]!.rate;
  for (const tier of product.tiers) {
    const byDsr = capacityRM > 0 ? loanFromInstalment(capacityRM, tier.rate, tenure) : 0;
    const loan = Math.min(byDsr, tier.maxLoanRM ?? Infinity);
    if (loan >= tier.minLoanRM && loan > maxLoanRM) {
      maxLoanRM = loan;
      maxRate = tier.rate;
    }
  }
  maxLoanRM = Math.floor(maxLoanRM / 1_000) * 1_000;
  const schemeOk = product.firstHomeScheme && c.firstHome;
  const maxPriceRM =
    maxLoanRM <= 0
      ? 0
      : Math.floor(
          (schemeOk && maxLoanRM <= SCHEME_PRICE_CAP ? maxLoanRM / SCHEME_MARGIN : maxLoanRM / STANDARD_MARGIN) / 10_000,
        ) * 10_000;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (product.purpose === "refinance") blockers.push("For refinancing a home you own, not buying one");
  if (product.purpose === "build") blockers.push("For building on your own land, not buying from a developer");
  if (product.firstHomeOnly && !c.firstHome) blockers.push("First-time buyers only");
  if (!product.citizens.includes(c.citizenship))
    blockers.push(product.citizens.length === 1 ? "Malaysians only" : "Malaysians and PRs only");
  if (product.employment && !product.employment.includes(c.employment)) blockers.push("Salaried applicants only");
  const age = c.income.age;
  if (age < product.minAge || age > product.maxAge) blockers.push(`Applicants aged ${product.minAge} to ${product.maxAge}`);
  if (product.minAnnualIncomeRM && k.annualGrossRM < product.minAnnualIncomeRM)
    blockers.push(`Needs ${rmK(product.minAnnualIncomeRM)} a year in income; you have ${rmK(k.annualGrossRM)}`);
  if (tenure < MIN_TENURE) blockers.push(`The loan must end by age ${LOAN_END_AGE}: under ${MIN_TENURE} years left`);
  if (c.employment === "self_employed" && c.jobTenure !== "2y_plus")
    blockers.push("Banks want 2 years of business records and Form B");
  if (c.employment === "commission" && c.jobTenure === "lt6m") blockers.push("Banks want 6 months of commission statements");
  if (c.employment === "salaried" && c.jobTenure === "lt6m")
    warnings.push("Most banks want you confirmed in the job, or 3 to 6 months of payslips");
  if (product.notes.some((n) => n.startsWith("Married"))) warnings.push("For married buyers");
  if (capacityRM <= 0 && tenure >= MIN_TENURE)
    blockers.push(`Your loans already use ${pct(commitmentsRM / Math.max(k.netRM, 1))} of take-home, over this bank's ${pct(dsrCap)}`);

  let target: ProductResult["target"] = null;
  let rate = maxRate;
  if (priceRM !== null && priceRM > 0) {
    const margin = marginFor(product, priceRM, c.firstHome);
    const loanRM = Math.round(priceRM * margin);
    const tier = tierFor(product, loanRM);
    rate = tier?.rate ?? maxRate;
    const years = Math.max(tenure, 1);
    const instalmentRM = monthlyInstalment(loanRM, rate, years);
    const dsrWithHome = k.netRM > 0 ? (commitmentsRM + instalmentRM) / k.netRM : Infinity;
    target = {
      priceRM,
      margin,
      loanRM,
      instalmentRM,
      stressInstalmentRM: monthlyInstalment(loanRM, rate + STRESS_RATE, years),
      dsrWithHome,
      leftRM: k.netRM - commitmentsRM - instalmentRM,
    };
    if (!tier) {
      const lo = productMinLoan(product);
      const hi = productMaxLoan(product);
      blockers.push(
        loanRM < lo
          ? `Lends from ${rmK(lo)}; this home needs ${rmK(loanRM)}`
          : `Lends up to ${rmK(hi)}; this home needs ${rmK(loanRM)}`,
      );
    }
    if (capacityRM > 0 && dsrWithHome > dsrCap)
      blockers.push(`DSR with this home ${pct1(dsrWithHome)}, over this bank's ${pct(dsrCap)}`);
    else if (capacityRM > 0 && dsrWithHome > dsrCap - DSR_BUFFER)
      warnings.push(`DSR ${pct1(dsrWithHome)} is within ${Math.round(DSR_BUFFER * 100)} points of the ${pct(dsrCap)} cap`);
  } else if (maxLoanRM <= 0 && capacityRM > 0) {
    blockers.push(`Lends from ${rmK(productMinLoan(product))}, more than your DSR allows`);
  }

  const verdict: Verdict = blockers.length ? "unlikely" : warnings.length ? "borderline" : "likely";
  return {
    product,
    lender,
    dsrCap,
    tenureYears: tenure,
    maxLoanRM,
    maxPriceRM,
    rate,
    target,
    verdict,
    reasons: [...blockers, ...warnings],
  };
}

const verdictRank: Record<Verdict, number> = { likely: 0, borderline: 1, unlikely: 2 };

/** Best first: likely before borderline before unlikely; then the lowest instalment (or biggest loan), then the lowest rate. */
export function compareResults(a: ProductResult, b: ProductResult) {
  const v = verdictRank[a.verdict] - verdictRank[b.verdict];
  if (v) return v;
  if (a.target && b.target) {
    const d = a.target.instalmentRM - b.target.instalmentRM;
    if (Math.abs(d) >= 1) return d;
  } else {
    const d = b.maxLoanRM - a.maxLoanRM;
    if (d) return d;
  }
  return a.rate - b.rate;
}

export type BankResult = {
  lender: Lender;
  best: ProductResult;
  /** This bank's other products, best first. */
  others: ProductResult[];
};

/** Every bank from the template, each with its best product for this buyer, best bank first. */
export function checkAllBanks(c: BankCheckInput, priceRM: number | null) {
  const k = counted(c);
  const all = products.map((p) => checkProduct(p, c, k, priceRM)).sort(compareResults);
  const banks: BankResult[] = lenders
    .map((lender) => {
      const mine = all.filter((r) => r.lender.id === lender.id);
      return { lender, best: mine[0]!, others: mine.slice(1) };
    })
    .filter((b) => b.best)
    .sort((a, b) => compareResults(a.best, b.best));
  const counts = { likely: 0, borderline: 0, unlikely: 0 };
  banks.forEach((b) => counts[b.best.verdict]++);
  return { k, banks, products: all, counts };
}

