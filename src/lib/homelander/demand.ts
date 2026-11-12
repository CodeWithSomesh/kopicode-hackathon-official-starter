import { passReasons, townships, units, type PassReason } from "./data";

/**
 * SAMPLE swipe log for the Gamuda view: 7 days of generated sessions from a fixed seed,
 * so every figure on the dashboard is computed from these rows and adds up.
 */

export const WINDOW = { from: "2026-11-05", to: "2026-11-11", label: "5–11 Nov 2026" };

export const segments = ["Under 35", "35 to 49", "50 and over"] as const;
export type Segment = (typeof segments)[number];

export type Swipe = { session: number; day: number; unitId: string; liked: boolean; reason: PassReason | null; segment: Segment };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const likeRate: Record<string, number> = {
  cove: 0.34, gardens: 0.41, tf7: 0.38, jade: 0.27, highpark: 0.47, robertson: 0.31, kundang: 0.36,
};

/** Share of each pass reason [Too far, Too pricey, Too small, Not my style] per township. */
const reasonMix: Record<string, [number, number, number, number]> = {
  cove: [0.55, 0.15, 0.05, 0.25],
  gardens: [0.45, 0.1, 0.1, 0.35],
  tf7: [0.25, 0.4, 0.05, 0.3],
  jade: [0.2, 0.55, 0.05, 0.2],
  highpark: [0.05, 0.2, 0.45, 0.3],
  robertson: [0.05, 0.35, 0.4, 0.2],
  kundang: [0.5, 0.05, 0.1, 0.35],
};

function generate(): Swipe[] {
  const rand = mulberry32(257);
  const rows: Swipe[] = [];
  const sessions = 412;
  for (let session = 0; session < sessions; session++) {
    const day = Math.floor(rand() * 7);
    const r = rand();
    const segment: Segment = r < 0.52 ? "Under 35" : r < 0.86 ? "35 to 49" : "50 and over";
    const count = 6 + Math.floor(rand() * 9);
    for (let i = 0; i < count; i++) {
      const unit = units[Math.floor(rand() * units.length)]!;
      let p = likeRate[unit.townshipId] ?? 0.35;
      if (segment === "Under 35") p += unit.landed ? -0.06 : 0.1;
      if (segment === "50 and over") p += unit.landed ? 0.08 : -0.12;
      if (unit.priceRM > 1_000_000 && segment === "Under 35") p -= 0.1;
      const liked = rand() < p;
      let reason: PassReason | null = null;
      if (!liked && rand() < 0.62) {
        // Projects without a tuned mix get an even spread of pass reasons.
        const mix = reasonMix[unit.townshipId] ?? [0.3, 0.3, 0.1, 0.3];
        let x = rand();
        let k = 0;
        while (k < 3 && x > mix[k]!) x -= mix[k++]!;
        reason = passReasons[k]!;
      }
      rows.push({ session, day, unitId: unit.id, liked, reason, segment });
    }
  }
  return rows;
}

export const swipes = generate();

const unitTownship = Object.fromEntries(units.map((u) => [u.id, u.townshipId]));
const unitLanded = Object.fromEntries(units.map((u) => [u.id, u.landed]));

export function demandSummary() {
  const total = swipes.length;
  const likes = swipes.filter((s) => s.liked).length;
  const buyers = new Set(swipes.map((s) => s.session)).size;

  const byTownship = townships
    .map((t) => {
      const rows = swipes.filter((s) => unitTownship[s.unitId] === t.id);
      const yes = rows.filter((s) => s.liked).length;
      const passes = rows.filter((s) => !s.liked);
      const withReason = passes.filter((s) => s.reason);
      const reasons = passReasons.map((r) => withReason.filter((s) => s.reason === r).length);
      return { township: t, swipes: rows.length, likes: yes, rate: yes / rows.length, passes: passes.length, withReason: withReason.length, reasons };
    })
    .sort((a, b) => b.rate - a.rate);

  const bySegment = segments.map((seg) => {
    const rows = swipes.filter((s) => s.segment === seg);
    const landed = rows.filter((s) => unitLanded[s.unitId]);
    const high = rows.filter((s) => !unitLanded[s.unitId]);
    return {
      segment: seg,
      buyers: new Set(rows.map((s) => s.session)).size,
      landedRate: landed.filter((s) => s.liked).length / landed.length,
      highRate: high.filter((s) => s.liked).length / high.length,
    };
  });

  // The finding: the township that loses the largest share of its explained passes to one reason.
  let finding = { township: byTownship[0]!.township.name, reason: passReasons[0] as PassReason, share: 0 };
  for (const t of byTownship) {
    t.reasons.forEach((n, i) => {
      const share = t.withReason ? n / t.withReason : 0;
      if (share > finding.share) finding = { township: t.township.name, reason: passReasons[i]!, share };
    });
  }

  console.assert(byTownship.reduce((a, t) => a + t.swipes, 0) === total, "township swipes must sum to total");
  console.assert(byTownship.reduce((a, t) => a + t.likes, 0) === likes, "township likes must sum to total likes");

  return { total, likes, rate: likes / total, buyers, byTownship, bySegment, finding };
}

export type SampleLead = {
  id: string;
  name: string;
  unitId: string;
  maxPriceRM: number;
  createdAt: string;
  reasons: string[];
  status: "New" | "Contacted" | "Viewing booked";
};

export const sampleLeads: SampleLead[] = [
  { id: "L-2041", name: "Jason Lim", unitId: "highpark-suites", maxPriceRM: 760_000, createdAt: "2026-11-11T16:42:00+08:00", reasons: ["Gives back 3.2 hours a week", "Within budget with RM2,100 left each month"], status: "New" },
  { id: "L-2038", name: "Priya Ramasamy", unitId: "gardens-valeria", maxPriceRM: 820_000, createdAt: "2026-11-11T11:05:00+08:00", reasons: ["Parents moving in: needs 4 bedrooms", "Walk to KTM Kuang"], status: "Contacted" },
  { id: "L-2033", name: "Hafiz Rahman", unitId: "cove-mori-pines", maxPriceRM: 900_000, createdAt: "2026-11-10T20:18:00+08:00", reasons: ["Works from home 3 days a week", "Wants a landed home near the park"], status: "Viewing booked" },
  { id: "L-2029", name: "Tan Mei Ling", unitId: "robertson-residences", maxPriceRM: 950_000, createdAt: "2026-11-10T09:37:00+08:00", reasons: ["Train person, office at KLCC", "Freehold in the city centre"], status: "Viewing booked" },
  { id: "L-2024", name: "Arjun Nair", unitId: "kundang-valerian", maxPriceRM: 640_000, createdAt: "2026-11-09T14:12:00+08:00", reasons: ["First home, tight budget", "Drives to Kepong"], status: "Contacted" },
];
