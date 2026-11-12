"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { MIN_TENURE, checkAllBanks, type BankCheckInput } from "@/lib/homelander/bank";
import { unitById, type Unit } from "@/lib/homelander/data";
import { toIncomeInput, type Profile } from "@/lib/homelander/profile";
import { homelander, useHomeLander, type HomeLanderState } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";
import { BankQuestions, YourNumbers } from "./inputs";
import { setPrefs, useBankPrefs, type BankPrefs } from "./prefs";
import { BankList, HowItWorks, NeedAnswers, NextSteps, ResultCard, TargetPicker } from "./results";

const noopSubscribe = () => () => {};
const filled = (v: unknown) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
/** Onboarded and Uncle actually heard something: the bank works from real answers only. */
const knowsBuyer = (s: HomeLanderState) => !!s.onboardedAt && Object.values(s.profile).some(filled);

export function BankView() {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const s = useHomeLander();
  const prefs = useBankPrefs();
  if (!mounted) return <Header />;
  if (!knowsBuyer(s)) return <UncleGate />;
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
          What 23 Malaysian banks are likely to lend you, worked out from what you told Uncle.
        </p>
      </div>
    </header>
  );
}

function UncleGate() {
  return (
    <div className="grid gap-8">
      <Header />
      <PixPanel className="mx-auto grid w-full max-w-xl justify-items-center gap-4 p-6 text-center sm:p-10">
        <Sprite art="uncle" scale={6} label="Uncle" />
        <h2 className="font-pixel text-2xl leading-tight sm:text-3xl">Uncle needs to know you first</h2>
        <p className="max-w-md text-[15px] text-ink">
          The bank check runs on your real pay, loans and age, the ones you tell Uncle. No answers, no guesses, so
          there&apos;s nothing to check yet.
        </p>
        <div className="p-1 pb-2">
          <PixButton asChild tone="pandan" size="lg">
            <Link href="/onboarding">
              <Sprite art="uncle" scale={2} />
              Sit with Uncle
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

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-8">
        {/* Phones: open questions first, then results, then the answered questions and numbers. Desktop: questions and numbers in the left column. */}
        <div className="contents lg:grid lg:min-w-0 lg:gap-6">
          <div className={cn("min-w-0 lg:order-none", open.length ? "order-1" : "order-3")}>
            <BankQuestions profile={s.profile} prefs={prefs} />
          </div>
          <div className="order-3 min-w-0 lg:order-none">
            <YourNumbers profile={s.profile} />
          </div>
        </div>

        <div className="order-2 grid min-w-0 grid-cols-1 gap-6 lg:order-none">
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
              {maxTenure >= MIN_TENURE ? (
                <TenurePicker value={prefs.tenureYears} max={maxTenure} current={result.k.tenureYears} />
              ) : null}
              <BankList banks={result.banks} k={result.k} hasTarget={targetPriceRM !== null} />
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
    <PixPanel flat className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <label htmlFor="bank-tenure" className="text-sm font-medium">
        Loan tenure
      </label>
      <div className="pix-frame pix-flat focus-within:outline-[3px] focus-within:outline-offset-[6px] focus-within:outline-kaya focus-within:outline-solid">
        <select
          id="bank-tenure"
          value={value === undefined ? "max" : String(current)}
          onChange={(e) => setPrefs({ tenureYears: e.target.value === "max" ? undefined : Number(e.target.value) })}
          className="h-10 bg-transparent px-3 text-sm font-medium tabular-nums focus-visible:outline-none"
        >
          <option value="max">Longest allowed ({max} years)</option>
          {options
            .filter((y) => y !== max)
            .map((y) => (
              <option key={y} value={y}>
                {y} years
              </option>
            ))}
        </select>
      </div>
      <p className="text-xs text-ink-soft">Shorter means a bigger instalment but far less interest.</p>
    </PixPanel>
  );
}
