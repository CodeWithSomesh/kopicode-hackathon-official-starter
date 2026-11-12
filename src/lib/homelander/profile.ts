import { z } from "zod";
import type { IncomeInput } from "./bank";

/**
 * What Mochi learns about a buyer during onboarding. Every field is optional: Mochi fills
 * them in as it hears answers, and the buyer can correct any of them in the side panel.
 * Money is per month in RM. The money fields map 1:1 onto the bank check's IncomeInput.
 */

const rm = z.number().min(0).max(10_000_000);

/**
 * The real struggles Malaysians face buying a home. Mochi asks which worry them most and the
 * deck, Battle and the card details all judge homes against them.
 */
export const painPoints = [
  "upfront_cash",
  "loan_approval",
  "monthly_burden",
  "hidden_costs",
  "commute_traffic",
  "build_delay",
  "resale_value",
  "leasehold_worry",
  "safety_security",
  "near_family",
  "space_too_small",
  "flood_risk",
] as const;
export type PainPoint = (typeof painPoints)[number];

/** i18n marker (npm run i18n:check sees tr(text)); render sites call t(label). The model prompt keeps the English. */
const tr = (s: string) => s;

/** Plain labels, as the buyer would say them. */
export const painPointLabel: Record<PainPoint, string> = {
  upfront_cash: tr("Cash upfront (deposit, stamp duty, legal fees)"),
  loan_approval: tr("Getting the loan approved"),
  monthly_burden: tr("Monthly instalment too high"),
  hidden_costs: tr("Hidden costs (maintenance, quit rent, reno)"),
  commute_traffic: tr("Traffic and a long commute"),
  build_delay: tr("Waiting years for the keys"),
  resale_value: tr("Resale value"),
  leasehold_worry: tr("Leasehold running out"),
  safety_security: tr("Safety and security"),
  near_family: tr("Being near family"),
  space_too_small: tr("Homes that are too small"),
  flood_risk: tr("Flooding"),
};

/** Short labels for pills and table rows. */
export const painPointShort: Record<PainPoint, string> = {
  upfront_cash: "Cash upfront",
  loan_approval: "Loan approval",
  monthly_burden: "Monthly instalment",
  hidden_costs: "Hidden costs",
  commute_traffic: "Traffic",
  build_delay: "Waiting for keys",
  resale_value: "Resale value",
  leasehold_worry: "Leasehold",
  safety_security: "Safety",
  near_family: "Near family",
  space_too_small: "Space",
  flood_risk: "Flooding",
};

/** The buyer's worries, biggest first (topWorry, then the rest), without repeats. */
export function worriesOf(p: Profile): PainPoint[] {
  const out: PainPoint[] = [];
  if (p.topWorry) out.push(p.topWorry);
  for (const w of p.painPoints ?? []) if (!out.includes(w)) out.push(w);
  return out;
}

/**
 * Fields older versions of onboarding asked for. Kept in the schema so saved profiles still parse,
 * but Mochi never asks for them and never fills them.
 */
export const legacyProfileKeys = ["kidsNow", "kidsPlanned", "schoolMatters", "schoolMaxKm", "schoolTransport"] as const;

export const profileSchema = z.object({
  // Household
  livingWith: z.enum(["alone", "partner", "partner_kids", "parents", "friends", "other"]).optional(),
  /** Everyone who will live in the home, the buyer included. */
  householdSize: z.number().int().min(1).max(15).optional(),
  parentsMovingIn: z.boolean().optional(),
  pets: z.boolean().optional(),
  // Worries: what scares them most about buying a home.
  painPoints: z.array(z.enum(painPoints)).max(painPoints.length).optional(),
  topWorry: z.enum(painPoints).optional(),
  worryNote: z.string().max(240).optional(),
  // Places
  workArea: z.string().max(120).optional(),
  officeDays: z.number().int().min(0).max(7).optional(),
  partnerWorkArea: z.string().max(120).optional(),
  commuteMode: z.enum(["car", "train", "mixed"]).optional(),
  preferredAreas: z.array(z.string().max(80)).max(8).optional(),
  mustBeNear: z.array(z.string().max(80)).max(8).optional(),
  // Home
  homeType: z.enum(["landed", "high_rise", "either"]).optional(),
  minBedrooms: z.number().int().min(1).max(8).optional(),
  mustHaves: z.array(z.string().max(80)).max(8).optional(),
  dealBreakers: z.array(z.string().max(80)).max(8).optional(),
  // Money (monthly RM unless noted)
  grossRM: rm.optional(),
  takeHomeRM: rm.optional(),
  otherIncomeRM: rm.optional(),
  joint: z.boolean().optional(),
  jointGrossRM: rm.optional(),
  carRM: rm.optional(),
  ptptnRM: rm.optional(),
  personalRM: rm.optional(),
  /** Outstanding balance, not the monthly payment. */
  cardBalanceRM: rm.optional(),
  housingRM: rm.optional(),
  /** Total savings for the down payment and fees, not monthly. */
  savingsRM: rm.optional(),
  firstHome: z.boolean().optional(),
  // Timing
  age: z.number().int().min(18).max(80).optional(),
  buyWithin: z.enum(["3m", "6m", "1y", "2y_plus"]).optional(),
  underConstructionOk: z.boolean().optional(),
  // Legacy (see legacyProfileKeys): never asked any more.
  kidsNow: z.number().int().min(0).max(10).optional(),
  kidsPlanned: z.enum(["yes", "maybe", "no"]).optional(),
  schoolMatters: z.boolean().optional(),
  schoolMaxKm: z.number().min(0).max(100).optional(),
  schoolTransport: z.enum(["drop_off", "school_bus", "walk", "other"]).optional(),
});

export type Profile = z.infer<typeof profileSchema>;
export type ProfileKey = keyof Profile;

/** What Mochi must have before the buyer can move on to swiping, with a plain label for each. */
export const essentials: { key: ProfileKey; label: string; when?: (p: Profile) => boolean }[] = [
  { key: "livingWith", label: tr("Who you live with") },
  { key: "topWorry", label: tr("What worries you most about buying") },
  { key: "workArea", label: tr("Where you work") },
  { key: "officeDays", label: tr("Office days a week") },
  { key: "commuteMode", label: tr("Car or train") },
  { key: "preferredAreas", label: tr("Areas you like") },
  { key: "homeType", label: tr("Landed or high-rise") },
  { key: "minBedrooms", label: tr("Bedrooms you need") },
  { key: "grossRM", label: tr("Monthly salary") },
  { key: "carRM", label: tr("Loans you're paying") },
  { key: "savingsRM", label: tr("Savings for the down payment") },
  { key: "firstHome", label: tr("First home or not") },
  { key: "age", label: tr("Your age") },
];

const filled = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

export function missingEssentials(p: Profile) {
  return essentials.filter((e) => (e.when ? e.when(p) : true) && !filled(p[e.key]));
}

/** Merge a patch from Mochi; undefined values never wipe what the buyer already gave. */
export function mergeProfile(p: Profile, patch: Partial<Profile>): Profile {
  const next: Profile = { ...p };
  for (const [k, v] of Object.entries(patch)) if (filled(v) || v === false || v === 0) (next as Record<string, unknown>)[k] = v;
  return next;
}

export function filledKeys(patch: Partial<Profile>) {
  return Object.entries(patch)
    .filter(([, v]) => filled(v) || v === false || v === 0)
    .map(([k]) => k as ProfileKey);
}

/** The bank check's input, from what Mochi collected. Null until salary and age are known. */
export function toIncomeInput(p: Profile): IncomeInput | null {
  if (p.grossRM === undefined || p.age === undefined) return null;
  return {
    grossRM: p.grossRM,
    otherIncomeRM: p.otherIncomeRM ?? 0,
    joint: p.joint ?? false,
    jointGrossRM: p.jointGrossRM ?? 0,
    takeHomeRM: p.takeHomeRM ?? null,
    age: p.age,
    commitments: {
      carRM: p.carRM ?? 0,
      ptptnRM: p.ptptnRM ?? 0,
      personalRM: p.personalRM ?? 0,
      cardBalanceRM: p.cardBalanceRM ?? 0,
      housingRM: p.housingRM ?? 0,
    },
  };
}
