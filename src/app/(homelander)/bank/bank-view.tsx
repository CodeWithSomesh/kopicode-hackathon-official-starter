"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import {
  cardMinimum,
  eligibility,
  emptyForm,
  parseRM,
  toInput,
  validate,
  type FieldKey,
  type FormValues,
  type IncomeInput,
} from "@/lib/homelander/bank";
import { rm, unitById, units, type Payslip } from "@/lib/homelander/data";
import { homelander, useHomeLander } from "@/lib/homelander/store";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import { MoneyField, PixSwitch } from "./fields";
import { BankTable, HomesInRange, ResultsEmpty, Summary } from "./results";
import { PayslipScan } from "./scan";

const steps: { title: string; fields: FieldKey[] }[] = [
  { title: "Your pay", fields: ["gross", "other", "takeHome"] },
  { title: "Who's borrowing", fields: ["jointGross", "age"] },
  { title: "What you already owe", fields: ["car", "ptptn", "personal", "card", "housing"] },
];

const stepOf = (k: FieldKey) => steps.findIndex((s) => s.fields.includes(k));

const focusField = (k: FieldKey) =>
  window.setTimeout(() => document.getElementById(`bank-${k}`)?.focus({ preventScroll: false }), 50);

export function BankView() {
  const { liked } = useHomeLander();
  const tr = useT();
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [attempted, setAttempted] = useState(false);
  const [step, setStep] = useState(0);
  const [committed, setCommitted] = useState<IncomeInput | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const errors = validate(values, tr);
  const shownErrors = attempted ? errors : {};
  const result = committed ? eligibility(committed) : null;

  const savedToast = useEffectEvent((maxPriceRM: number) =>
    toast.success(tr("Saved to your quest"), {
      id: "homelander-bank-saved",
      description: tr("Budget up to {amount}. Battle and Uncle will use it.", { amount: rm(maxPriceRM) }),
    }),
  );

  // Save to the quest whenever a fresh result settles, so Compare and Uncle can use it.
  useEffect(() => {
    if (!committed) return;
    const timer = window.setTimeout(() => {
      const e = eligibility(committed);
      homelander.setBudget({
        grossRM: e.grossRM,
        netRM: e.netRM,
        commitmentsRM: e.commitmentsRM,
        maxLoanRM: e.maxLoanRM,
        maxPriceRM: e.maxPriceRM,
      });
      savedToast(e.maxPriceRM);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [committed]);

  function update(next: FormValues) {
    setValues(next);
    // Once results are on screen they follow the form live, as long as it is valid.
    if (committed && Object.keys(validate(next, tr)).length === 0) setCommitted(toInput(next));
  }

  const set = (k: FieldKey) => (v: string) => update({ ...values, [k]: v });

  function submit(v: FormValues = values) {
    setAttempted(true);
    const errs = validate(v, tr);
    const first = (Object.keys(errs) as FieldKey[]).sort((a, b) => stepOf(a) - stepOf(b))[0];
    if (first) {
      setStep(stepOf(first));
      setNotice(errs[first] ?? "");
      focusField(first);
      return;
    }
    setNotice("");
    setCommitted(toInput(v));
    window.setTimeout(() => {
      if (window.matchMedia("(max-width: 1023px)").matches)
        document.getElementById("bank-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function next() {
    const bad = steps[step]!.fields.find((k) => errors[k]);
    if (bad) {
      setAttempted(true);
      focusField(bad);
      return;
    }
    setStep(step + 1);
    window.setTimeout(() => document.getElementById(`bank-step-${step + 1}`)?.focus(), 50);
  }

  function onRead(p: Payslip) {
    const v: FormValues = {
      ...values,
      gross: String(p.grossRM),
      takeHome: String(p.grossRM - p.epfRM - p.socsoRM - p.taxRM),
      car: String(p.carLoanRM),
      ptptn: String(p.ptptnRM),
    };
    setValues(v);
    if (v.age.trim() === "") {
      setStep(1);
      setNotice(tr("Payslip read. Add your age so we can work out how long the loan can run."));
      focusField("age");
      return;
    }
    submit(v);
  }

  const card = parseRM(values.card);
  const target =
    (targetId ? unitById[targetId] : undefined) ??
    defaultTarget(liked, result?.maxPriceRM ?? 0);

  return (
    <div className="grid gap-10">
      <header className="flex items-center gap-4">
        <PixPanel tone="kaya" flat className="flex size-16 shrink-0 items-center justify-center">
          <Sprite art="bank" scale={5} />
        </PixPanel>
        <div className="grid gap-1">
          <h1 className="font-pixel text-3xl leading-none font-bold lg:text-4xl">{tr("The Bank")}</h1>
          <p className="text-sm text-ink lg:text-base">
            {tr("Tell the banker what you earn and owe. Find out how much gold you can borrow for a Gamuda Land home.")}
          </p>
        </div>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10">
        <form
          noValidate
          onSubmit={(ev) => {
            ev.preventDefault();
            submit();
          }}
          className="grid gap-6"
          aria-label={tr("Income details")}
        >
          <PixPanel className="grid gap-5 p-5">
            <PayslipScan onRead={onRead} />

            <div className="flex items-center gap-2 lg:hidden" aria-hidden>
              {steps.map((s, i) => (
                <span key={s.title} className={cn("h-2.5 flex-1", i <= step ? "bg-ink" : "bg-ink/15")} />
              ))}
            </div>
            <p className="sr-only lg:hidden" aria-live="polite">
              {tr("Step {n} of {total}: {title}", { n: step + 1, total: steps.length, title: tr(steps[step]!.title) })}
            </p>
            {notice ? (
              <p role="status" className="border-l-4 border-kaya-deep bg-kaya/40 px-3 py-2 text-sm font-medium">
                {notice}
              </p>
            ) : null}

            <Step index={0} step={step}>
              <MoneyField
                id="bank-gross"
                label={tr("Monthly gross salary")}
                hint={tr("Before EPF and tax, as on your payslip.")}
                placeholder="0"
                value={values.gross}
                onChange={set("gross")}
                error={shownErrors.gross}
              />
              <MoneyField
                id="bank-other"
                label={tr("Other fixed income (optional)")}
                hint={tr("Fixed allowances or rental. We count 80%, as banks often count only part of it.")}
                placeholder="0"
                value={values.other}
                onChange={set("other")}
                error={shownErrors.other}
              />
              <MoneyField
                id="bank-takeHome"
                label={tr("Take-home pay (optional)")}
                hint={tr("Leave blank and we estimate it: EPF 11%, SOCSO and a rough PCB. Typing it is more accurate.")}
                placeholder={tr("We'll estimate")}
                value={values.takeHome}
                onChange={set("takeHome")}
                error={shownErrors.takeHome}
              />
            </Step>

            <Step index={1} step={step}>
              <PixSwitch
                id="bank-joint"
                label={tr("Apply with someone (joint loan)")}
                checked={values.joint}
                onChange={(joint) => update({ ...values, joint })}
              />
              {values.joint ? (
                <MoneyField
                  id="bank-jointGross"
                  label={tr("Their monthly gross salary")}
                  hint={tr("We estimate their take-home the same way.")}
                  placeholder="0"
                  value={values.jointGross}
                  onChange={set("jointGross")}
                  error={shownErrors.jointGross}
                />
              ) : null}
              <MoneyField
                id="bank-age"
                label={tr("Your age")}
                hint={tr("The loan runs up to 35 years and must end by age 70.")}
                prefix=""
                suffix={tr("years")}
                placeholder="30"
                maxLength={2}
                value={values.age}
                onChange={set("age")}
                error={shownErrors.age}
              />
            </Step>

            <Step index={2} step={step}>
              <p className="text-sm text-ink-soft">
                {values.joint ? tr("Monthly payments for both of you. Leave blank if none.") : tr("Monthly payments. Leave blank if none.")}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <MoneyField id="bank-car" label={tr("Car loan")} placeholder="0" value={values.car} onChange={set("car")} error={shownErrors.car} />
                <MoneyField id="bank-ptptn" label="PTPTN" placeholder="0" value={values.ptptn} onChange={set("ptptn")} error={shownErrors.ptptn} />
                <MoneyField
                  id="bank-personal"
                  label={tr("Personal loan")}
                  placeholder="0"
                  value={values.personal}
                  onChange={set("personal")}
                  error={shownErrors.personal}
                />
                <MoneyField
                  id="bank-housing"
                  label={tr("Other housing loan")}
                  placeholder="0"
                  value={values.housing}
                  onChange={set("housing")}
                  error={shownErrors.housing}
                />
              </div>
              <MoneyField
                id="bank-card"
                label={tr("Credit card balance owed")}
                hint={
                  card && !Number.isNaN(card)
                    ? tr("Banks count 5% a month: {amount}.", { amount: rm(cardMinimum(card)) })
                    : tr("The total balance. Banks count 5% of it as a monthly payment.")
                }
                placeholder="0"
                value={values.card}
                onChange={set("card")}
                error={shownErrors.card}
              />
            </Step>

            {/* Phones: stepped. Desktop: every section is visible, one submit. */}
            <div className="flex gap-3 lg:hidden">
              {step > 0 ? (
                <PixButton type="button" size="lg" onClick={() => setStep(step - 1)} className="flex-1">
                  {tr("Back")}
                </PixButton>
              ) : null}
              {step < steps.length - 1 ? (
                <PixButton type="button" tone="ink" size="lg" onClick={next} className="flex-[2]">
                  {tr("Next")}
                </PixButton>
              ) : (
                <PixButton type="submit" tone="pandan" size="lg" className="flex-[2]">
                  {tr("Ask the bank")}
                </PixButton>
              )}
            </div>
            <PixButton type="submit" tone="pandan" size="lg" className="hidden w-full lg:inline-flex">
              {committed ? tr("Ask again") : tr("Ask the bank")}
            </PixButton>
          </PixPanel>
        </form>

        <div id="bank-results" className="grid scroll-mt-4 gap-6 lg:sticky lg:top-4 lg:-m-3 lg:max-h-[calc(100svh-2rem)] lg:overflow-y-auto lg:p-3 lg:pb-5">
          {result && committed ? (
            <>
              <Summary e={result} />
              <BankTable input={committed} target={target} onTarget={setTargetId} />
            </>
          ) : (
            <ResultsEmpty />
          )}
        </div>
      </div>

      {result ? <HomesInRange e={result} /> : null}
    </div>
  );
}

function Step({ index, step, children }: { index: number; step: number; children: React.ReactNode }) {
  const tr = useT();
  return (
    <fieldset className={cn("grid gap-4", index !== step && "hidden lg:grid")}>
      <legend
        id={`bank-step-${index}`}
        tabIndex={-1}
        className="mb-4 flex items-center gap-2 font-pixel text-xl leading-none focus-visible:outline-none"
      >
        <span className="inline-flex size-7 items-center justify-center bg-ink text-sm text-white">{index + 1}</span>
        {tr(steps[index]!.title)}
      </legend>
      {children}
    </fieldset>
  );
}

/** The home the bank table checks first: your cheapest liked home, else the priciest one in range. */
function defaultTarget(liked: string[], maxPriceRM: number) {
  const likedUnits = units.filter((u) => liked.includes(u.id)).sort((a, b) => a.priceRM - b.priceRM);
  if (likedUnits[0]) return likedUnits[0];
  const sorted = [...units].sort((a, b) => a.priceRM - b.priceRM);
  return sorted.filter((u) => u.priceRM <= maxPriceRM).at(-1) ?? sorted[0]!;
}
