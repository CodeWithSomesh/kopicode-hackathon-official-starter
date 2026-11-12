import { z } from "zod";
import type { IncomeInput } from "./bank";

/**
 * What Uncle learns about a buyer during onboarding. Every field is optional: Uncle fills
 * them in as he hears answers, and the buyer can correct any of them in the side panel.
 * Money is per month in RM. The money fields map 1:1 onto the bank check's IncomeInput.
 */

const rm = z.number().min(0).max(10_000_000);

export const profileSchema = z.object({
  // Household
  livingWith: z.enum(["alone", "partner", "partner_kids", "parents", "friends", "other"]).optional(),
  kidsNow: z.number().int().min(0).max(10).optional(),
  kidsPlanned: z.enum(["yes", "maybe", "no"]).optional(),
  parentsMovingIn: z.boolean().optional(),
  pets: z.boolean().optional(),
  // Schools: we never ask which school, only whether distance matters.
  schoolMatters: z.boolean().optional(),
  schoolMaxKm: z.number().min(0).max(100).optional(),
  schoolTransport: z.enum(["drop_off", "school_bus", "walk", "other"]).optional(),
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
});

export type Profile = z.infer<typeof profileSchema>;
export type ProfileKey = keyof Profile;

/** What Uncle must have before the buyer can move on to swiping, with a plain label for each. */
export const essentials: { key: ProfileKey; label: string; when?: (p: Profile) => boolean }[] = [
  { key: "livingWith", label: "Who you live with" },
  { key: "kidsPlanned", label: "Kids in the next few years" },
  { key: "schoolMatters", label: "Whether school distance matters", when: (p) => p.kidsPlanned !== "no" || (p.kidsNow ?? 0) > 0 },
  { key: "workArea", label: "Where you work" },
  { key: "officeDays", label: "Office days a week" },
  { key: "commuteMode", label: "Car or train" },
  { key: "preferredAreas", label: "Areas you like" },
  { key: "homeType", label: "Landed or high-rise" },
  { key: "minBedrooms", label: "Bedrooms you need" },
  { key: "grossRM", label: "Monthly salary" },
  { key: "carRM", label: "Loans you're paying" },
  { key: "savingsRM", label: "Savings for the down payment" },
  { key: "firstHome", label: "First home or not" },
  { key: "age", label: "Your age" },
];

const filled = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

export function missingEssentials(p: Profile) {
  return essentials.filter((e) => (e.when ? e.when(p) : true) && !filled(p[e.key]));
}

/** Merge a patch from Uncle; undefined values never wipe what the buyer already gave. */
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

/** The bank check's input, from what Uncle collected. Null until salary and age are known. */
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
