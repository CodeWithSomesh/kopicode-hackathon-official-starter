import { eligibility } from "./bank";
import { anchorOptions, unitById, type Region } from "./data";
import { areas, bankSummaryFor, householdOf, leadScore, type BankSummary, type BuyerSession, type SwipeEvent } from "./demand";
import { toIncomeInput, worriesOf, type Profile } from "./profile";
import { anchorFor, realUnits, scoreUnit } from "./recommend";
import type { HomeLanderState } from "./store";

/**
 * LIVE data for /admin: what this browser did in the buyer app (localStorage store), turned
 * into the same BuyerSession shape as the sample so every chart can merge both. One session
 * per live lead (so each viewing request appears in the inbox); the first carries the swipes.
 */
export function liveSessions(st: HomeLanderState, nowMs: number): BuyerSession[] {
  // Carry the buyer's worries as the sample has them: the biggest one first, then the rest.
  const worries = worriesOf(st.profile);
  const p: Profile = worries.length ? { ...st.profile, topWorry: worries[0], painPoints: worries } : st.profile;
  const touched = Object.keys(st.profile).length > 0 || st.liked.length > 0 || st.passed.length > 0 || st.leads.length > 0 || st.budget !== null;
  if (!touched) return [];

  const realId = (id: string) => {
    const u = unitById[id];
    return u && realUnits.some((r) => r.id === u.id) ? u.id : null;
  };
  const work = anchorFor(p.workArea) ?? anchorOptions.find((a) => a.id === st.anchorId) ?? null;
  const income = toIncomeInput(p);
  const e = income ? eligibility(income) : null;
  const budget = st.budget ?? (e ? { grossRM: e.grossRM, netRM: e.netRM, commitmentsRM: e.commitmentsRM, maxLoanRM: e.maxLoanRM, maxPriceRM: e.maxPriceRM } : null);
  const score = (id: string) => scoreUnit(realUnits.find((u) => u.id === id)!, p, budget, work).score;

  const swipes: SwipeEvent[] = [];
  for (const id of st.liked) {
    const r = realId(id);
    if (r) swipes.push({ unitId: r, liked: true, reason: null, score: score(r) });
  }
  for (const x of st.passed) {
    const r = realId(x.id);
    if (r) swipes.push({ unitId: r, liked: false, reason: x.reason ?? null, score: score(r) });
  }
  const battleIds = st.compare.map(realId).filter((x): x is string => x !== null);
  // The store keeps the Battle line-up, not a winner: count the best match as the leading pick.
  const battle = battleIds.length >= 2 ? { unitIds: battleIds, winnerId: [...battleIds].sort((a, b) => score(b) - score(a))[0]! } : null;
  const target = battle?.winnerId ?? swipes.filter((x) => x.liked).sort((a, b) => b.score - a.score)[0]?.unitId ?? null;

  let bank: BankSummary | null = null;
  if (st.budget || st.scanned) {
    bank = bankSummaryFor(p, target) ?? {
      bestVerdict: "none",
      bestBank: "—",
      maxLoanRM: st.budget?.maxLoanRM ?? 0,
      targetUnitId: target,
      counts: { likely: 0, borderline: 0, unlikely: 0 },
      likelyBanks: [],
      blockers: [],
    };
  }

  const region: Region = areas.find((a) => p.preferredAreas?.includes(a.name))?.region ?? "klang-valley";
  const base: BuyerSession = {
    id: "LIVE-1",
    at: st.onboardedAt ? Date.parse(st.onboardedAt) : nowMs,
    live: true,
    region,
    buyerType: p.firstHome === false ? "Upgrader" : "First home",
    household: householdOf[p.livingWith ?? "alone"],
    profile: p,
    workId: work?.id ?? null,
    workLabel: work?.name ?? p.workArea ?? "Not given",
    maxCommuteMin: 45,
    steps: {
      chat: Object.keys(st.profile).length > 0 || st.onboardedAt !== null,
      onboarded: st.onboardedAt !== null || Object.keys(st.profile).length >= 8,
      swiped: swipes.length > 0,
      battled: battle !== null,
      bank: bank !== null,
      lead: false,
    },
    maxPriceRM: budget?.maxPriceRM ?? null,
    maxLoanRM: budget?.maxLoanRM ?? null,
    tenureYears: p.age ? Math.max(Math.min(35, 70 - p.age), 0) : 35,
    swipes,
    battle,
    bank,
    lead: null,
  };
  if (!st.leads.length) return [base];

  return st.leads.map((l, i) => {
    const unitId = realId(l.unitId) ?? target ?? realUnits[0]!.id;
    return {
      ...base,
      id: `LIVE-${i + 1}`,
      at: i === 0 ? base.at : Date.parse(l.createdAt),
      swipes: i === 0 ? base.swipes : [],
      steps: { ...base.steps, swiped: i === 0 ? base.steps.swiped : true, lead: true },
      lead: {
        id: l.id,
        name: l.name || "Live buyer",
        at: Date.parse(l.createdAt) || nowMs,
        status: "New" as const,
        score: leadScore(bank?.bestVerdict ?? "none", score(unitId), p),
        targetUnitId: unitId,
        reasons: l.reasons,
      },
      maxPriceRM: base.maxPriceRM ?? (l.maxPriceRM || null),
    };
  });
}
