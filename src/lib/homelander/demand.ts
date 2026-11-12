import { checkAllBanks, eligibility, tenureYears, type BankCheckInput, type BankId, type Employment, type JobTenure, type Verdict } from "./bank";
import { anchorOptions, distanceKm, passReasons, townshipById, type LatLng, type PassReason, type Region } from "./data";
import { toIncomeInput, type Profile } from "./profile";
import { bedroomsNeeded, realUnits, scoreUnit, DECK_LIKE_LIMIT, BATTLE_MAX, LIKES_TO_BATTLE } from "./recommend";
import type { Budget } from "./store";

/**
 * SAMPLE analytics for the Gamuda admin dashboard (/admin).
 *
 * 180 days of generated buyer sessions from a fixed seed, built on the REAL project and product
 * list (data.ts, realUnits) and run through the same logic as the buyer app: the bank limit comes
 * from bank.ts eligibility(), the deck from recommend.ts scoreUnit(), and bank verdicts from
 * checkAllBanks(). Every chart on /admin is computed from these rows (plus this browser's live
 * session), so the figures add up across sections. Buyer names are fictional.
 *
 * This file is the single source of sample analytics. Nothing here is real customer data.
 */

/* ---------------------------------------------------------------- calendar */

const DAY_MS = 86_400_000;
export const SAMPLE_DAYS = 180;
/** Sample data runs up to the end of 12 Nov 2026 (Malaysia time). "Today" is 13 Nov. */
export const SAMPLE_END_MS = Date.parse("2026-11-13T00:00:00+08:00");
/** The sample's "now", for ages of leads. */
export const SAMPLE_NOW_MS = Date.parse("2026-11-13T09:30:00+08:00");
export { DAY_MS };

/* ---------------------------------------------------------------- dimensions */

export const buyerTypes = ["First home", "Upgrader", "Investor"] as const;
export type BuyerType = (typeof buyerTypes)[number];

export const regions: { id: Region; label: string }[] = [
  { id: "klang-valley", label: "Klang Valley" },
  { id: "johor", label: "Johor" },
  { id: "sabah", label: "Sabah" },
];

export const households = ["Single", "Couple", "Family with kids", "Multi-generational", "Sharing"] as const;
export type Household = (typeof households)[number];

export const householdOf: Record<NonNullable<Profile["livingWith"]>, Household> = {
  alone: "Single",
  partner: "Couple",
  partner_kids: "Family with kids",
  parents: "Multi-generational",
  friends: "Sharing",
  other: "Sharing",
};

export const leadStatuses = ["New", "Contacted", "Viewing", "Booked"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

/** Areas buyers say they want to live in, with a rough centre for commute maths. */
export type Area = { name: string; region: Region; pos: LatLng; popularity: number; city?: boolean };
export const areas: Area[] = [
  { name: "Petaling Jaya", region: "klang-valley", pos: { lat: 3.11, lng: 101.61 }, popularity: 1.3 },
  { name: "Subang Jaya", region: "klang-valley", pos: { lat: 3.05, lng: 101.58 }, popularity: 1.2 },
  { name: "Puchong", region: "klang-valley", pos: { lat: 3.03, lng: 101.62 }, popularity: 1.15 },
  { name: "Cyberjaya", region: "klang-valley", pos: { lat: 2.92, lng: 101.65 }, popularity: 1.0 },
  { name: "Cheras", region: "klang-valley", pos: { lat: 3.06, lng: 101.76 }, popularity: 1.0 },
  { name: "Shah Alam", region: "klang-valley", pos: { lat: 3.07, lng: 101.52 }, popularity: 0.95 },
  { name: "Kajang", region: "klang-valley", pos: { lat: 2.99, lng: 101.79 }, popularity: 0.9 },
  { name: "Setia Alam", region: "klang-valley", pos: { lat: 3.1, lng: 101.45 }, popularity: 0.85 },
  { name: "Kota Kemuning", region: "klang-valley", pos: { lat: 2.99, lng: 101.54 }, popularity: 0.85 },
  { name: "Bangsar", region: "klang-valley", pos: { lat: 3.13, lng: 101.67 }, popularity: 0.8, city: true },
  { name: "Sungai Buloh", region: "klang-valley", pos: { lat: 3.21, lng: 101.58 }, popularity: 0.75 },
  { name: "Mont Kiara", region: "klang-valley", pos: { lat: 3.17, lng: 101.65 }, popularity: 0.7, city: true },
  { name: "Rawang", region: "klang-valley", pos: { lat: 3.32, lng: 101.57 }, popularity: 0.6 },
  { name: "Ampang", region: "klang-valley", pos: { lat: 3.15, lng: 101.76 }, popularity: 0.6, city: true },
  { name: "Semenyih", region: "klang-valley", pos: { lat: 2.95, lng: 101.84 }, popularity: 0.5 },
  { name: "Kuala Langat", region: "klang-valley", pos: { lat: 2.88, lng: 101.6 }, popularity: 0.45 },
  { name: "Iskandar Puteri", region: "johor", pos: { lat: 1.46, lng: 103.65 }, popularity: 1.2 },
  { name: "Johor Bahru", region: "johor", pos: { lat: 1.49, lng: 103.76 }, popularity: 1.0 },
  { name: "Kota Kinabalu", region: "sabah", pos: { lat: 5.98, lng: 116.07 }, popularity: 1.2 },
  { name: "Inanam", region: "sabah", pos: { lat: 5.97, lng: 116.13 }, popularity: 0.7 },
];

/** Workplaces outside the Klang Valley (anchorOptions only covers the Klang Valley). */
const otherWork: Record<Exclude<Region, "klang-valley">, { id: string; name: string; pos: LatLng }> = {
  johor: { id: "jb-city", name: "Johor Bahru city", pos: { lat: 1.4655, lng: 103.7578 } },
  sabah: { id: "kk-city", name: "Kota Kinabalu city", pos: { lat: 5.9804, lng: 116.0735 } },
};

/** Selling Gamuda townships that sit in (or are named after) an area. */
export function supplyIn(area: string) {
  const a = area.toLowerCase();
  return Object.values(townshipById).filter(
    (t) => t.status === "selling" && `${t.name} ${t.area}`.toLowerCase().includes(a),
  );
}

export const priceBands = [
  { id: "lt300", label: "< RM300k", min: 0, max: 300_000 },
  { id: "300-400", label: "RM300–400k", min: 300_000, max: 400_000 },
  { id: "400-500", label: "RM400–500k", min: 400_000, max: 500_000 },
  { id: "500-650", label: "RM500–650k", min: 500_000, max: 650_000 },
  { id: "650-800", label: "RM650–800k", min: 650_000, max: 800_000 },
  { id: "800-1m", label: "RM800k–1M", min: 800_000, max: 1_000_000 },
  { id: "1-1.5m", label: "RM1–1.5M", min: 1_000_000, max: 1_500_000 },
  { id: "1.5m+", label: "RM1.5M+", min: 1_500_000, max: Infinity },
] as const;

export function bandOf(priceRM: number) {
  return priceBands.find((b) => priceRM >= b.min && priceRM < b.max) ?? priceBands[priceBands.length - 1]!;
}

/* ---------------------------------------------------------------- session model */

export type SwipeEvent = { unitId: string; liked: boolean; reason: PassReason | null; score: number };

export type BankSummary = {
  bestVerdict: Verdict | "none";
  bestBank: string;
  maxLoanRM: number;
  targetUnitId: string | null;
  counts: Record<Verdict, number>;
  /** Lenders whose best product is "likely" for this buyer. */
  likelyBanks: BankId[];
  /** Blocker categories that stopped at least one bank. */
  blockers: string[];
};

export type LeadRecord = {
  id: string;
  name: string;
  at: number;
  status: LeadStatus;
  score: number;
  targetUnitId: string;
  reasons: string[];
};

export type BuyerSession = {
  id: string;
  /** Epoch ms of the landing visit. */
  at: number;
  live: boolean;
  region: Region;
  buyerType: BuyerType;
  household: Household;
  profile: Profile;
  workId: string | null;
  workLabel: string;
  /** Longest one-way commute the buyer told Mochi they'd accept, minutes. */
  maxCommuteMin: number;
  steps: { chat: boolean; onboarded: boolean; swiped: boolean; battled: boolean; bank: boolean; lead: boolean };
  /** From bank.ts eligibility() once income is known; null before. */
  maxPriceRM: number | null;
  maxLoanRM: number | null;
  tenureYears: number;
  swipes: SwipeEvent[];
  battle: { unitIds: string[]; winnerId: string } | null;
  bank: BankSummary | null;
  lead: LeadRecord | null;
};

/* ---------------------------------------------------------------- random helpers */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;

function weighted<T>(rand: Rand, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rand() * total;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i]!;
    if (x <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

function normal(rand: Rand) {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const between = (rand: Rand, lo: number, hi: number) => lo + rand() * (hi - lo);
const intBetween = (rand: Rand, lo: number, hi: number) => Math.floor(between(rand, lo, hi + 1));
const round = (n: number, to: number) => Math.round(n / to) * to;

/* ---------------------------------------------------------------- blockers */

/** Plain categories for bank.ts reason strings. Null: not a blocker worth reporting. */
export function blockerCategory(reason: string): string | null {
  if (/refinanc|building on your own land/i.test(reason)) return null;
  if (/DSR|take-home/i.test(reason)) return "Debt service ratio (DSR)";
  if (/a year in income/i.test(reason)) return "Below minimum income";
  if (/aged|must end by age/i.test(reason)) return "Age / loan tenure";
  if (/Lends (up to|from)/i.test(reason)) return "Loan outside product range";
  if (/First-time buyers only/i.test(reason)) return "First-home only product";
  if (/Malaysians/i.test(reason)) return "Citizenship";
  if (/Salaried/i.test(reason)) return "Employment type";
  if (/Form B|commission|payslips|confirmed/i.test(reason)) return "Job tenure / documents";
  if (/married/i.test(reason)) return null;
  return "Other";
}

/** Run the full bank check for a profile; used for sample buyers and the live buyer alike. */
export function bankSummaryFor(
  profile: Profile,
  targetUnitId: string | null,
  employment: Employment = "salaried",
  jobTenure: JobTenure = "2y_plus",
): BankSummary | null {
  const income = toIncomeInput(profile);
  if (!income) return null;
  const target = targetUnitId ? realUnits.find((u) => u.id === targetUnitId) ?? null : null;
  const input: BankCheckInput = {
    income,
    employment,
    jobTenure,
    citizenship: "malaysian",
    firstHome: profile.firstHome ?? true,
    savingsRM: profile.savingsRM ?? null,
    tenureYears: null,
  };
  const res = checkAllBanks(input, target?.priceRM ?? null);
  const best = res.banks[0]?.best;
  const blockers = new Set<string>();
  for (const b of res.banks)
    for (const r of b.best.reasons) {
      const c = blockerCategory(r);
      if (c) blockers.add(c);
    }
  return {
    bestVerdict: best?.verdict ?? "none",
    bestBank: best?.lender.name ?? "—",
    maxLoanRM: Math.max(0, ...res.banks.map((b) => b.best.maxLoanRM)),
    targetUnitId: target?.id ?? null,
    counts: res.counts,
    likelyBanks: res.banks.filter((b) => b.best.verdict === "likely").map((b) => b.lender.id),
    blockers: [...blockers],
  };
}

/* ---------------------------------------------------------------- generator */

const firstNames = {
  malay: ["Aiman", "Nur Aisyah", "Hafiz", "Siti Hajar", "Faris", "Nabila", "Irfan", "Amirah", "Danial", "Hidayah", "Syafiq", "Zulaikha"],
  chinese: ["Jason", "Mei Ling", "Wei Jie", "Jia Hui", "Kelvin", "Xin Yi", "Darren", "Hui Min", "Marcus", "Pei Shan", "Ryan", "Yee Ling"],
  indian: ["Arjun", "Priya", "Vikram", "Kavitha", "Suresh", "Anitha", "Ravin", "Deepa", "Pravin", "Shalini", "Kumar", "Thivya"],
};
const lastNames = {
  malay: ["Rahman", "Ismail", "Hassan", "Abdullah", "Yusof", "Aziz", "Hamzah", "Razak"],
  chinese: ["Lim", "Tan", "Wong", "Lee", "Ng", "Chong", "Ong", "Teoh"],
  indian: ["Ramasamy", "Nair", "Pillai", "Krishnan", "Subramaniam", "Menon", "Raj", "Gopal"],
};

const workWeights: Record<string, number> = {
  klcc: 14, "bangsar-south": 11, "kl-sentral": 9, pj: 12, cyberjaya: 9, "shah-alam": 8, kajang: 5,
  "mid-valley": 7, "damansara-heights": 6, "bukit-bintang": 7, "subang-usj": 7, puchong: 5,
};
const cityWork = new Set(["klcc", "kl-sentral", "bukit-bintang", "bangsar-south", "mid-valley"]);

/** How much buyers warm to each township beyond the match score (sample assumption). */
const appeal: Record<string, number> = {
  cove: 0.95, gardens: 1.15, "gardens-park": 1.05, tf7: 1.1, jade: 0.9, kundang: 0.95, haus15: 1.2,
  horizon: 1.0, bantayan: 1.0, highpark: 0.8,
};

/** How often buyers pass a township on looks alone (sample assumption). */
const styleBias: Record<string, number> = { cove: 1.3, highpark: 1.7, haus15: 1.4, jade: 0.8, bantayan: 1.2, horizon: 0.9, kundang: 1.1 };

/** Visitors per day: growth over the half-year, busier weekends, an open-house spike in October. */
function visitorsOn(rand: Rand, dayIndex: number, dayMs: number) {
  const growth = 20 + (dayIndex / SAMPLE_DAYS) * 18;
  const dow = new Date(dayMs + 8 * 3_600_000).getUTCDay();
  const weekend = dow === 0 || dow === 6 ? 1.35 : 1;
  const openHouse = dayMs >= Date.parse("2026-10-17T00:00:00+08:00") && dayMs < Date.parse("2026-10-20T00:00:00+08:00") ? 1.8 : 1;
  return Math.max(4, Math.round(growth * weekend * openHouse * (1 + normal(rand) * 0.15)));
}

function makeProfile(rand: Rand, region: Region, buyerType: BuyerType) {
  const age =
    buyerType === "First home"
      ? Math.round(Math.min(40, Math.max(23, 29 + normal(rand) * 3.5)))
      : buyerType === "Upgrader"
        ? intBetween(rand, 33, 52)
        : intBetween(rand, 30, 58);
  const livingWith = weighted<NonNullable<Profile["livingWith"]>>(
    rand,
    ["alone", "partner", "partner_kids", "parents", "friends"],
    buyerType === "First home" ? [30, 40, 18, 8, 4] : buyerType === "Upgrader" ? [5, 15, 60, 20, 0] : [35, 30, 35, 0, 0],
  );
  const kidsNow = livingWith === "partner_kids" ? intBetween(rand, 1, 3) : 0;
  const kidsPlanned = weighted<"yes" | "maybe" | "no">(
    rand,
    ["yes", "maybe", "no"],
    livingWith === "partner" ? [55, 30, 15] : livingWith === "partner_kids" ? [30, 30, 40] : [20, 30, 50],
  );
  const parentsMovingIn = livingWith === "parents" || (buyerType === "Upgrader" && rand() < 0.15);
  const schoolMatters = kidsNow > 0 ? rand() < 0.85 : kidsPlanned === "yes" ? rand() < 0.6 : kidsPlanned === "maybe" ? rand() < 0.3 : false;

  // Income: rises with age, upgraders and investors earn more. Gross monthly RM.
  const base = (3_000 + (age - 22) * 220) * Math.exp(normal(rand) * 0.33) * (buyerType === "Upgrader" ? 1.35 : buyerType === "Investor" ? 1.6 : 1);
  const regional = region === "klang-valley" ? 1 : region === "johor" ? 0.85 : 0.78;
  const grossRM = round(Math.max(2_600, base * regional), 100);
  const couple = livingWith === "partner" || livingWith === "partner_kids";
  const joint = couple && rand() < 0.7;
  const jointGrossRM = joint ? round(Math.max(2_500, grossRM * 0.8 * Math.exp(normal(rand) * 0.3)), 100) : 0;

  const carRM = rand() < 0.72 ? round(between(rand, 450, 1_300), 10) : 0;
  const ptptnRM = age < 35 && rand() < 0.45 ? round(between(rand, 120, 320), 10) : 0;
  const personalRM = rand() < 0.14 ? round(between(rand, 300, 900), 10) : 0;
  const cardBalanceRM = rand() < 0.4 ? round(between(rand, 1_000, 12_000), 100) : 0;
  const housingRM =
    buyerType === "Upgrader" && rand() < 0.7 ? round(between(rand, 1_200, 2_800), 10) : buyerType === "Investor" && rand() < 0.6 ? round(between(rand, 1_500, 4_000), 10) : 0;
  const savingsRM = round(
    buyerType === "First home" ? between(rand, 15_000, 80_000) : buyerType === "Upgrader" ? between(rand, 60_000, 250_000) : between(rand, 80_000, 400_000),
    1_000,
  );

  // Work
  let workId: string | null = null;
  let workLabel: string;
  let workPos: LatLng;
  if (region === "klang-valley") {
    const ids = anchorOptions.map((a) => a.id);
    workId = weighted(rand, ids, ids.map((id) => workWeights[id] ?? 4));
    const a = anchorOptions.find((x) => x.id === workId)!;
    workLabel = a.name;
    workPos = a.pos;
  } else {
    const w = otherWork[region];
    workLabel = w.name;
    workPos = w.pos;
  }
  const officeDays = weighted(rand, [2, 3, 4, 5], [5, 30, 20, 45]);
  const commuteMode = weighted<"car" | "train" | "mixed">(
    rand,
    ["car", "train", "mixed"],
    region !== "klang-valley" ? [92, 0, 8] : workId && cityWork.has(workId) ? [45, 33, 22] : [72, 12, 16],
  );
  const maxCommuteMin = commuteMode === "train" ? intBetween(rand, 40, 70) : intBetween(rand, 30, 60);

  // Preferred areas: popular places near work, families lean suburban.
  const family = livingWith === "partner_kids" || livingWith === "parents" || kidsPlanned === "yes";
  const pool = areas.filter((a) => a.region === region);
  const w = pool.map((a) => a.popularity * Math.exp(-distanceKm(a.pos, workPos) / 16) * (family && a.city ? 0.45 : 1) + 0.02);
  const want = intBetween(rand, 1, Math.min(3, pool.length));
  const preferredAreas: string[] = [];
  for (let i = 0; i < want; i++) {
    const left = pool.filter((a) => !preferredAreas.includes(a.name));
    const lw = left.map((a) => w[pool.indexOf(a)]!);
    preferredAreas.push(weighted(rand, left, lw).name);
  }

  const homeType = weighted<"landed" | "high_rise" | "either">(
    rand,
    ["landed", "high_rise", "either"],
    buyerType === "Investor" ? [20, 60, 20] : family ? [62, 15, 23] : [22, 52, 26],
  );

  const profile: Profile = {
    livingWith,
    kidsNow,
    kidsPlanned,
    parentsMovingIn,
    pets: rand() < 0.3,
    schoolMatters,
    schoolMaxKm: schoolMatters ? intBetween(rand, 3, 10) : undefined,
    workArea: workLabel,
    officeDays,
    commuteMode,
    preferredAreas,
    mustBeNear: commuteMode !== "car" ? ["MRT/LRT station"] : [],
    homeType,
    grossRM,
    otherIncomeRM: 0,
    joint,
    jointGrossRM,
    carRM,
    ptptnRM,
    personalRM,
    cardBalanceRM,
    housingRM,
    savingsRM,
    firstHome: buyerType === "First home",
    age,
    buyWithin: weighted<"3m" | "6m" | "1y" | "2y_plus">(rand, ["3m", "6m", "1y", "2y_plus"], [15, 30, 35, 20]),
    underConstructionOk: rand() < 0.7,
  };
  profile.minBedrooms = bedroomsNeeded(profile);
  return { profile, workId, workLabel, workPos, maxCommuteMin };
}

function passReason(rand: Rand, unitId: string, fit: string, beds: number, need: number, workPos: LatLng, preferred: string[]): PassReason {
  const u = realUnits.find((x) => x.id === unitId)!;
  const t = townshipById[u.townshipId]!;
  const km = distanceKm(t.pos, workPos);
  const inArea = preferred.some((a) => `${t.name} ${t.area}`.toLowerCase().includes(a.toLowerCase()));
  const w = [
    0.4 + (km > 30 ? 2.6 : km > 18 ? 1.3 : 0) + (inArea ? -0.3 : 0.4),
    0.3 + (fit === "over" ? 1.8 : fit === "stretch" ? 0.9 : 0),
    0.2 + (beds < need ? 2.4 : !u.landed ? 0.6 : 0),
    0.9 * (styleBias[t.id] ?? 1),
  ];
  return weighted(rand, passReasons, w);
}

function generate(): BuyerSession[] {
  const rand = mulberry32(20261113);
  const sessions: BuyerSession[] = [];
  const nameUsed = new Set<string>();
  let leadSeq = 1000;

  for (let d = 0; d < SAMPLE_DAYS; d++) {
    const dayMs = SAMPLE_END_MS - (SAMPLE_DAYS - d) * DAY_MS;
    const n = visitorsOn(rand, d, dayMs);
    // Product got better over time: later sessions convert slightly better.
    const lift = 0.9 + (d / SAMPLE_DAYS) * 0.2;
    for (let i = 0; i < n; i++) {
      const hour = weighted(rand, [8, 10, 12, 14, 16, 18, 20, 22], [4, 8, 10, 8, 8, 12, 18, 12]);
      const at = dayMs + (hour + rand() * 2) * 3_600_000;
      const region = weighted<Region>(rand, ["klang-valley", "johor", "sabah"], [84, 11, 5]);
      const buyerType = weighted(rand, buyerTypes, [58, 30, 12]);
      const { profile, workId, workLabel, workPos, maxCommuteMin } = makeProfile(rand, region, buyerType);
      const household = householdOf[profile.livingWith!];

      const chat = rand() < 0.6 * lift;
      const onboarded = chat && rand() < 0.78 * lift;

      const income = toIncomeInput(profile)!;
      const e = eligibility(income);
      const budget: Budget = { grossRM: e.grossRM, netRM: e.netRM, commitmentsRM: e.commitmentsRM, maxLoanRM: e.maxLoanRM, maxPriceRM: e.maxPriceRM };
      const work = workId ? anchorOptions.find((a) => a.id === workId)! : null;

      const s: BuyerSession = {
        id: `S-${(sessions.length + 1).toString().padStart(5, "0")}`,
        at,
        live: false,
        region,
        buyerType,
        household,
        profile,
        workId,
        workLabel,
        maxCommuteMin,
        steps: { chat, onboarded, swiped: false, battled: false, bank: false, lead: false },
        maxPriceRM: onboarded ? e.maxPriceRM : null,
        maxLoanRM: onboarded ? e.maxLoanRM : null,
        tenureYears: tenureYears(profile.age!),
        swipes: [],
        battle: null,
        bank: null,
        lead: null,
      };
      sessions.push(s);
      if (!onboarded || rand() > 0.93) continue;

      // The deck: the buyer's region first (best match first), a few Klang Valley picks for out-of-towners.
      const picks = realUnits.map((u) => scoreUnit(u, profile, budget, work)).sort((a, b) => b.score - a.score);
      const local = picks.filter((p) => townshipById[p.unit.townshipId]!.region === region);
      const deck = region === "klang-valley" ? local : [...local, ...picks.filter((p) => townshipById[p.unit.townshipId]!.region === "klang-valley").slice(0, 4)];
      const need = bedroomsNeeded(profile);
      let likes = 0;
      for (const p of deck) {
        if (likes >= DECK_LIKE_LIMIT) break;
        if (s.swipes.length > 2 && rand() < 0.07) break; // got bored
        const t = townshipById[p.unit.townshipId]!;
        let pl = (1 / (1 + Math.exp(-(p.score - 50) / 9))) * 0.85 * (appeal[t.id] ?? 1);
        if (p.fit === "over") pl *= 0.25;
        else if (p.fit === "stretch") pl *= 0.6;
        if (t.region !== region) pl *= 0.3;
        pl = Math.min(0.92, pl * lift);
        const liked = rand() < pl;
        if (liked) likes++;
        const reason = liked || rand() > 0.76 ? null : passReason(rand, p.unit.id, p.fit, p.unit.beds, need, workPos, profile.preferredAreas ?? []);
        s.swipes.push({ unitId: p.unit.id, liked, reason, score: p.score });
      }
      s.steps.swiped = s.swipes.length > 0;
      const liked = s.swipes.filter((x) => x.liked).sort((a, b) => b.score - a.score);

      if (liked.length >= LIKES_TO_BATTLE && rand() < 0.7 * lift) {
        const inBattle = liked.slice(0, BATTLE_MAX);
        const winner = weighted(rand, inBattle, inBattle.map((x) => x.score ** 2));
        s.battle = { unitIds: inBattle.map((x) => x.unitId), winnerId: winner.unitId };
        s.steps.battled = true;
      }

      // The bank check sits after Battle in the flow (spec step 7), so only battlers reach it.
      if (!s.steps.battled || rand() > 0.66 * lift) continue;
      const target = s.battle?.winnerId ?? liked[0]?.unitId ?? null;
      const employment = weighted<Employment>(rand, ["salaried", "self_employed", "commission"], [82, 12, 6]);
      const jobTenure = weighted<JobTenure>(rand, ["2y_plus", "1to2y", "6to12m", "lt6m"], [65, 20, 10, 5]);
      s.bank = bankSummaryFor(profile, target, employment, jobTenure);
      s.steps.bank = s.bank !== null;
      if (!s.bank || !target) continue;

      const v = s.bank.bestVerdict;
      const pLead = v === "likely" ? 0.55 : v === "borderline" ? 0.3 : 0.06;
      if (rand() > pLead * lift) continue;

      // A pre-qualified viewing request.
      const eth = weighted(rand, ["malay", "chinese", "indian"] as const, [55, 32, 13]);
      let name = "";
      for (let k = 0; k < 5 && (!name || nameUsed.has(name)); k++) {
        const fn = firstNames[eth];
        const ln = lastNames[eth];
        name = `${fn[Math.floor(rand() * fn.length)]} ${ln[Math.floor(rand() * ln.length)]}`;
      }
      nameUsed.add(name);
      const leadAt = at + between(rand, 10, 55) * 60_000;
      const ageDays = (SAMPLE_NOW_MS - leadAt) / DAY_MS;
      let status: LeadStatus = "New";
      if (ageDays > 1 && rand() < 0.75) status = "Contacted";
      if (status === "Contacted" && ageDays > 4 && rand() < 0.5) status = "Viewing";
      if (status === "Viewing" && ageDays > 9 && rand() < 0.4) status = "Booked";
      const targetPick = liked.find((x) => x.unitId === target) ?? liked[0]!;
      s.lead = {
        id: `L-${++leadSeq}`,
        name,
        at: leadAt,
        status,
        score: leadScore(v, targetPick.score, profile),
        targetUnitId: target,
        reasons: scoreUnit(realUnits.find((u) => u.id === target)!, profile, budget, work).reasons.slice(0, 2),
      };
      s.steps.lead = true;
    }
  }
  return sessions;
}

/** 0–100: bank verdict 40, match 30, buying timeline 20, savings 10. */
export function leadScore(v: Verdict | "none", match: number, p: Profile) {
  const bank = v === "likely" ? 40 : v === "borderline" ? 22 : 5;
  const timing = { "3m": 20, "6m": 14, "1y": 8, "2y_plus": 3 }[p.buyWithin ?? "1y"];
  const savings = Math.min(10, ((p.savingsRM ?? 0) / 60_000) * 10);
  return Math.round(Math.min(100, bank + match * 0.3 + timing + savings));
}

let cache: BuyerSession[] | null = null;

/** The seeded sample sessions (generated once, then cached). */
export function sampleSessions(): BuyerSession[] {
  if (!cache) cache = generate();
  return cache;
}
