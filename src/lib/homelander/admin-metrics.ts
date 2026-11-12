import { lenders } from "./bank";
import { availabilityOf, LOAN_RATE, MARGIN, monthlyInstalment, passReasons, rmShort, townshipById, type PassReason, type Region } from "./data";
import {
  areas,
  bandOf,
  buyerTypes,
  DAY_MS,
  households,
  leadStatuses,
  priceBands,
  SAMPLE_END_MS,
  supplyIn,
  type BuyerSession,
  type BuyerType,
  type LeadRecord,
  type LeadStatus,
} from "./demand";
import { realUnits } from "./recommend";

/**
 * Every number on /admin, computed from buyer sessions (sample + live) for the chosen
 * window and segment. Pure functions: same sessions and filters, same dashboard.
 */

export type RangeDays = 7 | 30 | 90;
export type Filters = { days: RangeDays; region: Region | "all"; buyerType: BuyerType | "all"; showSample: boolean };

export const pct = (x: number, digits = 0) => (Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : "–");
export const num = (n: number) => Math.round(n).toLocaleString("en-MY");
export const rmFull = (n: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 }).format(n);
export const rmCompact = (n: number) =>
  n <= 0 ? "RM0" : n >= 1_000_000_000 ? `RM${(n / 1_000_000_000).toFixed(2)}B` : n >= 1_000_000 ? `RM${(n / 1_000_000).toFixed(1)}M` : rmShort(n);

const share = (a: number, b: number) => (b > 0 ? a / b : 0);

/* ---------------------------------------------------------------- slicing */

export function windowOf(days: RangeDays) {
  const end = SAMPLE_END_MS;
  const start = end - days * DAY_MS;
  return { start, end, prevStart: start - days * DAY_MS, bucketMs: days === 90 ? 7 * DAY_MS : DAY_MS, buckets: days === 90 ? Math.ceil(days / 7) : days };
}

function matches(s: BuyerSession, f: Filters) {
  if (f.region !== "all" && s.region !== f.region) return false;
  if (f.buyerType !== "all" && s.buyerType !== f.buyerType) return false;
  return true;
}

export function slice(all: BuyerSession[], f: Filters) {
  const w = windowOf(f.days);
  const cur: BuyerSession[] = [];
  const prev: BuyerSession[] = [];
  for (const s of all) {
    if (!s.live && !f.showSample) continue;
    if (!matches(s, f)) continue;
    // Live sessions belong to "today", the newest bucket, whatever the clock says.
    if (s.live || (s.at >= w.start && s.at < w.end)) cur.push(s);
    else if (s.at >= w.prevStart && s.at < w.start) prev.push(s);
  }
  return { cur, prev, ...w };
}

export function bucketOf(s: BuyerSession, w: ReturnType<typeof windowOf>) {
  if (s.live) return w.buckets - 1;
  return Math.min(w.buckets - 1, Math.max(0, Math.floor((s.at - w.start) / w.bucketMs)));
}

export function bucketLabels(w: ReturnType<typeof windowOf>) {
  const fmt = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" });
  return Array.from({ length: w.buckets }, (_, i) => fmt.format(new Date(w.start + i * w.bucketMs)));
}

/* ---------------------------------------------------------------- totals & KPIs */

const qualified = (s: BuyerSession) => s.steps.lead && (s.bank?.bestVerdict === "likely" || s.bank?.bestVerdict === "borderline");
const targetPrice = (s: BuyerSession) => realUnits.find((u) => u.id === s.lead?.targetUnitId)?.priceRM ?? 0;

export function totals(ss: BuyerSession[]) {
  let chats = 0, onboarded = 0, swipers = 0, swipes = 0, likes = 0, battles = 0, bank = 0, leads = 0, qual = 0, pipeline = 0;
  for (const s of ss) {
    if (s.steps.chat) chats++;
    if (s.steps.onboarded) onboarded++;
    if (s.steps.swiped) swipers++;
    swipes += s.swipes.length;
    for (const x of s.swipes) if (x.liked) likes++;
    if (s.steps.battled) battles++;
    if (s.steps.bank) bank++;
    if (s.steps.lead) leads++;
    if (qualified(s)) {
      qual++;
      pipeline += targetPrice(s);
    }
  }
  return { visitors: ss.length, chats, onboarded, swipers, swipes, likes, likeRate: share(likes, swipes), onboardRate: share(onboarded, chats), battles, bank, leads, qualified: qual, pipeline };
}
export type Totals = ReturnType<typeof totals>;

export type Kpi = {
  id: keyof Totals;
  label: string;
  value: number;
  prev: number;
  /** Relative change, or percentage-point change for rates. */
  delta: number | null;
  kind: "count" | "rate" | "money";
  note: string;
  series: number[];
};

export function kpis(sl: ReturnType<typeof slice>): Kpi[] {
  const c = totals(sl.cur);
  const p = totals(sl.prev);
  const byBucket: BuyerSession[][] = Array.from({ length: sl.buckets }, () => []);
  for (const s of sl.cur) byBucket[bucketOf(s, sl)]!.push(s);
  const bt = byBucket.map(totals);
  const make = (id: keyof Totals, label: string, kind: Kpi["kind"], note: string): Kpi => {
    const value = c[id];
    const prev = p[id];
    const delta = p.visitors === 0 ? (value === 0 ? 0 : null) : kind === "rate" ? value - prev : prev > 0 ? (value - prev) / prev : null;
    return { id, label, value, prev, delta, kind, note, series: bt.map((t) => t[id]) };
  };
  return [
    make("visitors", "Visitors", "count", "Landed on the HomeLander map"),
    make("onboarded", "Completed onboarding", "count", `${pct(c.onboardRate)} of ${num(c.chats)} chats with Mochi`),
    make("swipes", "Homes swiped", "count", `${(c.swipers ? c.swipes / c.swipers : 0).toFixed(1)} per swiping buyer`),
    make("likeRate", "Like rate", "rate", `${num(c.likes)} likes`),
    make("battles", "Battles run", "count", `${pct(share(c.battles, c.swipers))} of swiping buyers`),
    make("bank", "Bank checks", "count", `${pct(share(c.bank, c.swipers))} of swiping buyers`),
    make("qualified", "Pre-qualified leads", "count", `${pct(share(c.qualified, c.visitors), 1)} of visitors`),
    make("pipeline", "Est. pipeline value", "money", "Target home prices of qualified leads"),
  ];
}

export function trend(sl: ReturnType<typeof slice>) {
  const labels = bucketLabels(sl);
  const rows = labels.map((label) => ({ label, visitors: 0, onboarded: 0, leads: 0 }));
  for (const s of sl.cur) {
    const r = rows[bucketOf(s, sl)]!;
    r.visitors++;
    if (s.steps.onboarded) r.onboarded++;
    if (s.steps.lead) r.leads++;
  }
  return rows;
}

/* ---------------------------------------------------------------- funnel */

export function funnel(ss: BuyerSession[]) {
  // Each step counts sessions that also reached every earlier step, so the funnel only narrows.
  const chain = [(s: BuyerSession) => s.steps.chat, (s: BuyerSession) => s.steps.swiped, (s: BuyerSession) => s.steps.battled, (s: BuyerSession) => s.steps.bank, (s: BuyerSession) => s.steps.lead];
  const reached = (k: number) => ss.filter((s) => chain.slice(0, k).every((f) => f(s))).length;
  const steps = [
    { id: "landing", label: "Landing", hint: "Opened the map", n: ss.length },
    { id: "chat", label: "Chat with Mochi", hint: "Started onboarding", n: reached(1) },
    { id: "swipe", label: "Swipe", hint: "Finished onboarding and swiped", n: reached(2) },
    { id: "battle", label: "Battle", hint: "Compared 3+ liked homes", n: reached(3) },
    { id: "bank", label: "Bank check", hint: "Ran the eligibility check", n: reached(4) },
    { id: "lead", label: "Lead", hint: "Asked for a viewing", n: reached(5) },
  ];
  const t = { visitors: ss.length, leads: steps[5]!.n };
  const rows = steps.map((s, i) => {
    const prev = i === 0 ? s.n : steps[i - 1]!.n;
    return { ...s, fromPrev: share(s.n, prev), dropOff: i === 0 ? 0 : 1 - share(s.n, prev), ofTotal: share(s.n, t.visitors) };
  });
  const worst = rows.slice(1).reduce((a, b) => (b.dropOff > a.dropOff ? b : a), rows[1]!);
  return { rows, worst, overall: share(t.leads, t.visitors) };
}

/* ---------------------------------------------------------------- demand vs supply */

const unitsIn = (region: Filters["region"]) =>
  realUnits.filter((u) => region === "all" || townshipById[u.townshipId]!.region === region);

export function townshipDemand(ss: BuyerSession[], region: Filters["region"]) {
  const units = unitsIn(region);
  const ids = [...new Set(units.map((u) => u.townshipId))];
  const rows = ids.map((id) => {
    const t = townshipById[id]!;
    const mine = new Set(units.filter((u) => u.townshipId === id).map((u) => u.id));
    let shown = 0, likes = 0, scoreSum = 0, wins = 0, inBattle = 0;
    const reasons: Record<PassReason, number> = { "Too far": 0, "Too pricey": 0, "Too small": 0, "Not my style": 0 };
    for (const s of ss) {
      for (const x of s.swipes)
        if (mine.has(x.unitId)) {
          shown++;
          scoreSum += x.score;
          if (x.liked) likes++;
          else if (x.reason) reasons[x.reason]++;
        }
      if (s.battle) {
        if (s.battle.unitIds.some((u) => mine.has(u))) inBattle++;
        if (mine.has(s.battle.winnerId)) wins++;
      }
    }
    const reasonTotal = passReasons.reduce((a, r) => a + reasons[r], 0);
    const topReason = reasonTotal ? passReasons.reduce((a, r) => (reasons[r] > reasons[a] ? r : a), passReasons[0]) : null;
    const unitsLeft = [...mine].reduce((a, u) => a + availabilityOf(u).left, 0);
    return {
      id,
      name: t.name,
      area: t.area,
      status: t.status ?? "selling",
      shown,
      likes,
      likeRate: share(likes, shown),
      wins,
      winRate: share(wins, inBattle),
      avgScore: shown ? scoreSum / shown : 0,
      reasons,
      reasonTotal,
      topReason,
      unitsLeft,
      index: 0,
    };
  });
  const totalLikes = rows.reduce((a, r) => a + r.likes, 0);
  const totalLeft = rows.reduce((a, r) => a + r.unitsLeft, 0);
  for (const r of rows) r.index = share(share(r.likes, totalLikes), share(r.unitsLeft, totalLeft));
  rows.sort((a, b) => b.index - a.index);
  const hot = rows.filter((r) => r.index >= 1.5 && r.likes >= 10);
  return { rows, hot, totalLikes, totalLeft };
}

/* ---------------------------------------------------------------- where buyers live vs work */

export function locations(ss: BuyerSession[], region: Filters["region"]) {
  const buyers = ss.filter((s) => s.steps.onboarded);
  const n = buyers.length;
  const pool = areas.filter((a) => region === "all" || a.region === region);
  const areaRows = pool
    .map((a) => {
      const who = buyers.filter((s) => s.profile.preferredAreas?.includes(a.name));
      const work: Record<string, number> = {};
      who.forEach((s) => (work[s.workLabel] = (work[s.workLabel] ?? 0) + 1));
      const topWork = Object.entries(work).sort((x, y) => y[1] - x[1])[0]?.[0] ?? "–";
      const supply = supplyIn(a.name);
      return { name: a.name, buyers: who.length, share: share(who.length, n), supplied: supply.length > 0, projects: supply.map((t) => t.name), topWork };
    })
    .filter((r) => r.buyers > 0)
    .sort((a, b) => b.buyers - a.buyers);

  const workMap: Record<string, number> = {};
  buyers.forEach((s) => (workMap[s.workLabel] = (workMap[s.workLabel] ?? 0) + 1));
  const workRows = Object.entries(workMap)
    .map(([name, c]) => ({ name, buyers: c, share: share(c, n) }))
    .sort((a, b) => b.buyers - a.buyers);

  const modes = (["car", "train", "mixed"] as const).map((m) => {
    const who = buyers.filter((s) => s.profile.commuteMode === m);
    return {
      mode: m,
      label: m === "car" ? "Car" : m === "train" ? "Rail" : "Car + rail",
      buyers: who.length,
      share: share(who.length, n),
      avgMax: who.length ? who.reduce((a, s) => a + s.maxCommuteMin, 0) / who.length : 0,
    };
  });
  const avgMax = n ? buyers.reduce((a, s) => a + s.maxCommuteMin, 0) / n : 0;
  const unserved = areaRows.filter((r) => !r.supplied);
  return { n, areaRows, workRows, modes, avgMax, unserved, unservedShare: share(buyers.filter((s) => s.profile.preferredAreas?.some((a) => unserved.some((u) => u.name === a)) && !s.profile.preferredAreas?.some((a) => areaRows.find((r) => r.name === a)?.supplied)).length, n) };
}

/* ---------------------------------------------------------------- price band gap */

export function priceGap(ss: BuyerSession[], region: Filters["region"]) {
  const selling = unitsIn(region).filter((u) => townshipById[u.townshipId]!.status === "selling");
  const buyers = ss.filter((s) => s.steps.onboarded && (s.maxPriceRM ?? 0) > 0);
  const n = buyers.length;
  const rows = priceBands.map((b) => ({ id: b.id, label: b.label, buyers: 0, unmatched: 0, products: 0, productNames: [] as string[] }));
  for (const u of selling) {
    const r = rows.find((x) => x.id === bandOf(u.priceRM).id)!;
    r.products++;
    r.productNames.push(u.name);
  }
  for (const s of buyers) {
    const max = s.maxPriceRM!;
    const r = rows.find((x) => x.id === bandOf(max).id)!;
    r.buyers++;
    const local = selling.filter((u) => townshipById[u.townshipId]!.region === s.region);
    if (!local.some((u) => u.priceRM <= max && u.priceRM >= max * 0.7)) r.unmatched++;
  }
  const out = rows.map((r) => ({ ...r, share: share(r.buyers, n), unmatchedShare: share(r.unmatched, r.buyers) }));
  const gap = out.reduce((a, b) => (b.unmatched > a.unmatched ? b : a), out[0]!);
  const unmatchedAll = share(out.reduce((a, r) => a + r.unmatched, 0), n);
  return { n, rows: out, gap, unmatchedAll };
}

/* ---------------------------------------------------------------- segments */

export const ageBands = ["Under 30", "30–34", "35–39", "40–49", "50+"] as const;
export const ageBandOf = (age: number) => (age < 30 ? ageBands[0] : age < 35 ? ageBands[1] : age < 40 ? ageBands[2] : age < 50 ? ageBands[3] : ageBands[4]);
export const incomeBands = ["< RM5k", "RM5–8k", "RM8–12k", "RM12–20k", "RM20k+"] as const;
export const householdGross = (s: BuyerSession) => (s.profile.grossRM ?? 0) + (s.profile.joint ? s.profile.jointGrossRM ?? 0 : 0);
export const incomeBandOf = (g: number) => (g < 5_000 ? incomeBands[0] : g < 8_000 ? incomeBands[1] : g < 12_000 ? incomeBands[2] : g < 20_000 ? incomeBands[3] : incomeBands[4]);

export function segments(ss: BuyerSession[]) {
  const b = ss.filter((s) => s.steps.onboarded);
  const n = b.length;
  const count = <T extends string>(keys: readonly T[], f: (s: BuyerSession) => T) =>
    keys.map((k) => {
      const who = b.filter((s) => f(s) === k);
      return { name: k, buyers: who.length, share: share(who.length, n), leadRate: share(who.filter((s) => s.steps.lead).length, who.length) };
    });
  const household = count(households, (s) => s.household).filter((r) => r.buyers > 0);
  const age = count(ageBands, (s) => ageBandOf(s.profile.age ?? 30));
  const income = count(incomeBands, (s) => incomeBandOf(householdGross(s)));
  const type = count(buyerTypes, (s) => s.buyerType);
  const firstHome = share(b.filter((s) => s.profile.firstHome).length, n);
  const kids = [
    { name: "Kids at home", share: share(b.filter((s) => (s.profile.kidsNow ?? 0) > 0).length, n) },
    { name: "Planning kids", share: share(b.filter((s) => s.profile.kidsPlanned === "yes").length, n) },
    { name: "School distance matters", share: share(b.filter((s) => s.profile.schoolMatters).length, n) },
    { name: "Parents moving in", share: share(b.filter((s) => s.profile.parentsMovingIn).length, n) },
  ];
  const schoolKm = b.filter((s) => s.profile.schoolMatters && s.profile.schoolMaxKm);
  const avgSchoolKm = schoolKm.length ? schoolKm.reduce((a, s) => a + s.profile.schoolMaxKm!, 0) / schoolKm.length : 0;
  const homeType = (["landed", "high_rise", "either"] as const).map((h) => ({
    name: h === "landed" ? "Landed" : h === "high_rise" ? "High-rise" : "Either",
    buyers: b.filter((s) => s.profile.homeType === h).length,
    share: share(b.filter((s) => s.profile.homeType === h).length, n),
  }));

  // Who converts best: household x age, with enough buyers to trust.
  const avgLead = share(b.filter((s) => s.steps.lead).length, n);
  const combos: { household: string; age: string; n: number; leadRate: number; lift: number; landed: number; medianMax: number }[] = [];
  for (const h of households)
    for (const a of ageBands) {
      const who = b.filter((s) => s.household === h && ageBandOf(s.profile.age ?? 30) === a);
      if (who.length < 20) continue;
      const lr = share(who.filter((s) => s.steps.lead).length, who.length);
      const maxes = who.map((s) => s.maxPriceRM ?? 0).sort((x, y) => x - y);
      combos.push({
        household: h,
        age: a,
        n: who.length,
        leadRate: lr,
        lift: share(lr, avgLead),
        landed: share(who.filter((s) => s.profile.homeType === "landed").length, who.length),
        medianMax: maxes[Math.floor(maxes.length / 2)] ?? 0,
      });
    }
  combos.sort((x, y) => y.leadRate - x.leadRate);
  // Only suggest a segment that clearly beats the average on enough leads to mean something.
  const best = combos.find((c) => c.lift >= 1.2 && c.leadRate * c.n >= 3) ?? null;
  return { n, household, age, income, type, firstHome, kids, avgSchoolKm, homeType, best, avgLead };
}

/* ---------------------------------------------------------------- pass reasons */

export const reasonAction: Record<PassReason, string> = {
  "Too far": "Lead with rail, feeder bus and toll-free route story; show door-to-door times on the card",
  "Too pricey": "Push first-home schemes, entry layouts and rebates; show the monthly, not the price",
  "Too small": "Show floor plans and family-size or dual-key layouts first",
  "Not my style": "Refresh photography and show-unit design; A/B test facades and interiors",
};

/* ---------------------------------------------------------------- products */

export function products(sl: ReturnType<typeof slice>, region: Filters["region"]) {
  const ss = sl.cur;
  return unitsIn(region).map((u) => {
    let shown = 0, likes = 0, inBattle = 0, wins = 0, eligible = 0, likedBank = 0, costSum = 0, costN = 0;
    const series = Array.from({ length: sl.buckets }, () => 0);
    for (const s of ss) {
      for (const x of s.swipes) {
        if (x.unitId !== u.id) continue;
        shown++;
        if (x.liked) {
          likes++;
          series[bucketOf(s, sl)]!++;
          if (s.maxPriceRM !== null) {
            likedBank++;
            if (s.maxPriceRM >= u.priceRM) eligible++;
            costSum += monthlyInstalment(u.priceRM * MARGIN, LOAN_RATE, Math.max(s.tenureYears, 5));
            costN++;
          }
        }
      }
      if (s.battle?.unitIds.includes(u.id)) {
        inBattle++;
        if (s.battle.winnerId === u.id) wins++;
      }
    }
    const t = townshipById[u.townshipId]!;
    return {
      id: u.id,
      name: u.name,
      township: t.name,
      status: t.status ?? "selling",
      type: u.type,
      priceRM: u.priceRM,
      shown,
      likes,
      likeRate: share(likes, shown),
      winRate: share(wins, inBattle),
      battles: inBattle,
      eligibleShare: share(eligible, likedBank),
      monthlyRM: costN ? costSum / costN : monthlyInstalment(u.priceRM * MARGIN),
      unitsLeft: availabilityOf(u.id).left,
      series,
    };
  });
}
export type ProductRow = ReturnType<typeof products>[number];

/* ---------------------------------------------------------------- leads */

export type LeadRow = {
  session: BuyerSession;
  lead: LeadRecord;
  status: LeadStatus;
};

export function leads(ss: BuyerSession[], overrides: Record<string, LeadStatus>): LeadRow[] {
  return ss
    .filter((s) => s.lead)
    .map((s) => ({ session: s, lead: s.lead!, status: overrides[s.lead!.id] ?? s.lead!.status }))
    .sort((a, b) => Number(b.session.live) - Number(a.session.live) || b.lead.at - a.lead.at);
}

export function pipelineCounts(rows: LeadRow[]) {
  return leadStatuses.map((st) => ({ status: st, n: rows.filter((r) => r.status === st).length }));
}

/* ---------------------------------------------------------------- bank */

/** Blockers that come from a bank product's rules rather than the buyer's finances. */
const productLimits = new Set(["Loan outside product range", "First-home only product", "Citizenship", "Employment type"]);

export function bankInsights(ss: BuyerSession[]) {
  const checked = ss.filter((s) => s.bank);
  const n = checked.length;
  const verdicts = (["likely", "borderline", "unlikely"] as const).map((v) => {
    const c = checked.filter((s) => s.bank!.bestVerdict === v).length;
    return { verdict: v, n: c, share: share(c, n) };
  });
  const blockerMap: Record<string, number> = {};
  checked.forEach((s) => s.bank!.blockers.forEach((b) => (blockerMap[b] = (blockerMap[b] ?? 0) + 1)));
  const blockers = Object.entries(blockerMap)
    .map(([name, c]) => ({ name, n: c, share: share(c, n), kind: productLimits.has(name) ? ("product" as const) : ("buyer" as const) }))
    .sort((a, b) => b.n - a.n);
  const bankMap: Record<string, number> = {};
  checked.forEach((s) => s.bank!.likelyBanks.forEach((id) => (bankMap[id] = (bankMap[id] ?? 0) + 1)));
  const banks = lenders
    .map((l) => ({ id: l.id, name: l.name, n: bankMap[l.id] ?? 0, share: share(bankMap[l.id] ?? 0, n) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);
  const avgLikely = n ? checked.reduce((a, s) => a + s.bank!.counts.likely, 0) / n : 0;
  return { n, verdicts, blockers, banks, avgLikely };
}

/* ---------------------------------------------------------------- CSV */

export function leadsCsv(rows: LeadRow[]) {
  const head = ["Lead ID", "Source", "Created", "Status", "Name", "Household", "Buyer type", "Household income band", "Best bank verdict", "Best bank", "Max loan (RM)", "Target home", "Township", "Target price (RM)", "Lead score"];
  const fmt = new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });
  const lines = rows.map((r) => {
    const u = realUnits.find((x) => x.id === r.lead.targetUnitId);
    return [
      r.lead.id,
      r.session.live ? "Live" : "Sample",
      fmt.format(new Date(r.lead.at)),
      r.status,
      r.lead.name,
      r.session.household,
      r.session.buyerType,
      incomeBandOf(householdGross(r.session)),
      r.session.bank?.bestVerdict ?? "Not checked",
      r.session.bank?.bestBank ?? "",
      r.session.bank?.maxLoanRM ?? r.session.maxLoanRM ?? "",
      u?.name ?? r.lead.targetUnitId,
      u ? townshipById[u.townshipId]!.name : "",
      u?.priceRM ?? "",
      r.lead.score,
    ];
  });
  return [head, ...lines].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
