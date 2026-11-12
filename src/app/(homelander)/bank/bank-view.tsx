"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { MochiBot } from "@/components/homelander/mochi-bot";
import { Sprite } from "@/components/homelander/sprite";
import { MIN_TENURE, checkAllBanks, type BankCheckInput } from "@/lib/homelander/bank";
import { unitById, type Unit } from "@/lib/homelander/data";
import { toIncomeInput, type Profile } from "@/lib/homelander/profile";
import { homelander, useHomeLander, type HomeLanderState } from "@/lib/homelander/store";
import { BankQuestions, YourNumbers } from "./inputs";
import { setPrefs, useBankPrefs, type BankPrefs } from "./prefs";
import { BuyerPanel } from "./buyer";
import { BankList, HowItWorks, NeedAnswers, NextSteps, ResultCard, TargetPicker, summaryText } from "./results";

const noopSubscribe = () => () => {};
const filled = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
/** Onboarded and Mochi actually heard something: the bank works from real answers only. */
const knowsBuyer = (s: HomeLanderState) => !!s.onboardedAt && Object.values(s.profile).some(filled);

export function BankView() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const s = useHomeLander();
  const prefs = useBankPrefs();
  if (!mounted) return <Header />;
  if (!knowsBuyer(s)) return <MochiGate />;
  return <Bank s={s} prefs={prefs} />;
}

function Header() {
  return (
    <header className="flex items-center gap-4">
      <PixPanel tone="kaya" flat className="flex size-16 shrink-0 items-center justify-center">
        <Sprite art="bank" scale={5} />
      </PixPanel>
      <div className="grid gap-1">
        <h1 className="font-pixel text-3xl leading-none lg:text-4xl">The Bank</h1>
        <p className="text-sm text-ink lg:text-base">
          What 23 Malaysian banks are likely to lend you, worked out from what you told Mochi.
        </p>
      </div>
    </header>
  );
}

function MochiGate() {
  return (
    <div className="grid gap-8">
      <Header />
      <PixPanel className="mx-auto grid w-full max-w-xl justify-items-center gap-4 p-6 text-center sm:p-10">
        <MochiBot size={132} />
        <h2 className="font-pixel text-2xl leading-tight sm:text-3xl">Mochi needs to get to know you first</h2>
        <p className="max-w-md text-[15px] text-ink">
          The bank check runs on your real pay, loans and age, the ones you tell Mochi. No answers, no guesses, so
          there&apos;s nothing to check yet.
        </p>
        <div className="p-1 pb-2">
          <PixButton asChild tone="pandan" size="lg">
            <Link href="/onboarding">
              <Sprite art="mochi" scale={2} />
              Chat with Mochi
            </Link>
          </PixButton>
        </div>
      </PixPanel>
    </div>
  );
}

/** Liked and compared homes, compared first, in the order the buyer added them. */
function shortlist(s: HomeLanderState): Unit[] {
  const ids = [...s.compare, ...s.liked.filter((id) => !s.compare.includes(id))];
  return ids.map((id) => unitById[id]).filter((u): u is Unit => !!u);
}

function buildInput(p: Profile, prefs: BankPrefs): BankCheckInput | null {
  const income = toIncomeInput(p);
  if (!income || !income.grossRM || !prefs.employment || !prefs.jobTenure || !prefs.citizenship) return null;
  if (p.firstHome === undefined || income.age < 18) return null;
  return {
    income,
    employment: prefs.employment,
    jobTenure: prefs.jobTenure,
    citizenship: prefs.citizenship,
    firstHome: p.firstHome,
    savingsRM: p.savingsRM ?? null,
    tenureYears: prefs.tenureYears ?? null,
  };
}

function openQuestions(p: Profile, prefs: BankPrefs) {
  const open: string[] = [];
  if (!p.grossRM) open.push("Your salary");
  if (p.age === undefined) open.push("Your age");
  if (!prefs.employment) open.push("How you're paid");
  if (!prefs.jobTenure) open.push("Time in the job");
  if (!prefs.citizenship) open.push("Citizenship");
  if (p.firstHome === undefined) open.push("First home or not");
  return open;
}

function Bank({ s, prefs }: { s: HomeLanderState; prefs: BankPrefs }) {
  const homes = shortlist(s);
  const target = prefs.target;
  const targetUnit =
    target?.kind === "home" ? (unitById[target.id] ?? null) : target === undefined ? (homes[0] ?? null) : null;
  const targetPriceRM = target?.kind === "price" ? target.priceRM : (targetUnit?.priceRM ?? null);

  const input = buildInput(s.profile, prefs);
  const result = input ? checkAllBanks(input, targetPriceRM) : null;
  const open = openQuestions(s.profile, prefs);

  // Keep the shared budget in step with these numbers, so Swipe and Battle use the same limit.
  const budgetE = result?.k.e;
  useEffect(() => {
    if (!budgetE) return;
    const t = window.setTimeout(() => {
      const cur = homelander.snapshot().budget;
      const next = {
        grossRM: budgetE.grossRM,
        netRM: budgetE.netRM,
        commitmentsRM: budgetE.commitmentsRM,
        maxLoanRM: budgetE.maxLoanRM,
        maxPriceRM: budgetE.maxPriceRM,
      };
      if (!cur || (Object.keys(next) as (keyof typeof next)[]).some((key) => cur[key] !== next[key]))
        homelander.setBudget(next);
    }, 500);
    return () => window.clearTimeout(t);
  }, [budgetE]);

  const top = result?.banks[0];
  const best = top?.best;
  const inRange =
    best && best.verdict !== "unlikely"
      ? (homes.filter((u) => u.priceRM <= best.maxPriceRM).sort((a, b) => b.priceRM - a.priceRM)[0] ?? null)
      : null;
  const maxTenure = result?.k.maxTenureYears ?? 0;

  return (
    <div className="grid gap-8">
      <Header />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8">
        {/* Left: who the buyer is and the headline. Sticky on desktop; on phones it comes first, folded. */}
        <aside
          aria-label="Your details"
          className="grid min-w-0 gap-4 lg:sticky lg:top-4 lg:-m-2 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:p-2"
        >
          <BuyerPanel
            profile={s.profile}
            prefs={prefs}
            k={result?.k ?? null}
            top={top ?? null}
            open={open}
            summary={top ? summaryText(top, targetUnit) : null}
          />
          <details open={open.length > 0 || undefined} className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-full px-4 text-sm font-medium hover:bg-cloud focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-kaya focus-visible:outline-solid [&::-webkit-details-marker]:hidden">
              {open.length ? `Answer ${open.length} more to see your banks` : "Change your answers"}
              <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="transition-transform group-open:rotate-180">
                <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </summary>
            <div className="mt-4 grid gap-4">
              <BankQuestions profile={s.profile} prefs={prefs} />
              <YourNumbers profile={s.profile} />
            </div>
          </details>
        </aside>

        {/* Right: every bank the buyer can apply to. */}
        <div className="grid min-w-0 grid-cols-1 gap-6">
          <TargetPicker homes={homes} target={target} targetUnit={targetUnit} targetPriceRM={targetPriceRM} />

          {result && top ? (
            <>
              <ResultCard
                top={top}
                k={result.k}
                targetUnit={targetUnit}
                savingsRM={input?.savingsRM ?? null}
                firstHome={input?.firstHome ?? false}
              />
              <BankList
                banks={result.banks}
                k={result.k}
                hasTarget={targetPriceRM !== null}
                toolbar={
                  maxTenure >= MIN_TENURE ? (
                    <TenurePicker value={prefs.tenureYears} max={maxTenure} current={result.k.tenureYears} />
                  ) : null
                }
              />
              <NextSteps inRange={inRange} top={top} />
            </>
          ) : (
            <NeedAnswers open={open} />
          )}
        </div>
      </div>

      {result ? <HowItWorks k={result.k} /> : null}
    </div>
  );
}

function TenurePicker({ value, max, current }: { value: number | undefined; max: number; current: number }) {
  const options = Array.from(new Set([max, 30, 25, 20, 15, 10].filter((y) => y <= max && y >= MIN_TENURE)));
  return (
    <div className="flex items-center gap-2" title="Shorter means a bigger instalment but far less interest.">
      <label htmlFor="bank-tenure" className="text-sm text-ink-soft">
        Tenure
      </label>
      <div className="pix-frame pix-flat focus-within:outline-[3px] focus-within:outline-offset-[6px] focus-within:outline-kaya focus-within:outline-solid">
        <select
          id="bank-tenure"
          value={value === undefined ? "max" : String(current)}
          onChange={(e) => setPrefs({ tenureYears: e.target.value === "max" ? undefined : Number(e.target.value) })}
          className="h-9 bg-transparent px-2 text-sm font-medium tabular-nums focus-visible:outline-none"
        >
          <option value="max">Longest ({max} years)</option>
          {options
            .filter((y) => y !== max)
            .map((y) => (
              <option key={y} value={y}>
                {y} years
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
