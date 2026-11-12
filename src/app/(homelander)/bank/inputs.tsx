"use client";

import { useState } from "react";
import { PixPanel, PixTag } from "@/components/homelander/pixel";
import { LOAN_END_AGE, MAX_TENURE, MIN_TENURE, cardMinimum, type Citizenship, type Employment, type JobTenure } from "@/lib/homelander/bank";
import { rm } from "@/lib/homelander/data";
import type { Profile } from "@/lib/homelander/profile";
import { homelander } from "@/lib/homelander/store";
import { MoneyField, PixSwitch, Segmented } from "./fields";
import { setPrefs, type BankPrefs } from "./prefs";

type MoneyKey =
  | "grossRM"
  | "takeHomeRM"
  | "otherIncomeRM"
  | "jointGrossRM"
  | "carRM"
  | "ptptnRM"
  | "personalRM"
  | "cardBalanceRM"
  | "housingRM"
  | "savingsRM";

const employmentOptions = [
  { value: "salaried", label: "Salaried" },
  { value: "self_employed", label: "Self-employed" },
  { value: "commission", label: "Commission" },
] as const satisfies readonly { value: Employment; label: string }[];

const jobOptions = [
  { value: "lt6m", label: "0–6 mo" },
  { value: "6to12m", label: "6–12 mo" },
  { value: "1to2y", label: "1–2 yrs" },
  { value: "2y_plus", label: "2+ yrs" },
] as const satisfies readonly { value: JobTenure; label: string }[];

const citizenOptions = [
  { value: "malaysian", label: "Malaysian" },
  { value: "pr", label: "PR" },
  { value: "foreigner", label: "Foreigner" },
] as const satisfies readonly { value: Citizenship; label: string }[];

const MAX_RM = 10_000_000;

function parseAmount(raw: string): number | null | "bad" {
  const s = raw.replace(/[,\s]/g, "").replace(/^RM/i, "");
  if (s === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return "bad";
  const n = Number(s);
  return n > MAX_RM ? "bad" : n;
}

const fmt = (n: number | undefined) => (n === undefined ? "" : n.toLocaleString("en-MY"));

/**
 * A money field bound to the buyer's profile. Valid edits write straight back to the store,
 * so Swipe, Battle and Uncle see the same numbers. Blank clears the answer.
 */
function ProfileMoney({
  k,
  profile,
  label,
  hint,
  required,
  extraError,
}: {
  k: MoneyKey;
  profile: Profile;
  label: string;
  hint?: string;
  required?: boolean;
  extraError?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = profile[k];
  const shown = draft ?? fmt(value);
  const parsed = draft === null ? (value ?? null) : parseAmount(draft);
  const error =
    parsed === "bad"
      ? `${label} should be a plain amount in ringgit, like 1,250.`
      : required && (parsed === null || parsed === 0)
        ? `Enter your ${label.toLowerCase()}. Every bank starts from it.`
        : extraError;
  return (
    <MoneyField
      id={`bank-${k}`}
      label={label}
      hint={hint}
      error={error}
      placeholder={required ? "Needed" : "0"}
      value={shown}
      onChange={(raw) => {
        setDraft(raw);
        const n = parseAmount(raw);
        if (n === "bad") return;
        if (n === null) {
          if (!required) homelander.setProfileField(k, undefined);
          return;
        }
        if (required && n === 0) return;
        homelander.setProfileField(k, n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function ProfileAge({ profile }: { profile: Profile }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (profile.age === undefined ? "" : String(profile.age));
  const n = shown.trim() === "" ? null : Number(shown);
  const error =
    n === null
      ? "Enter your age. It sets how long the loan can run."
      : !Number.isInteger(n) || n < 18 || n > 80
        ? "Enter your age as a whole number, 18 to 80."
        : n > LOAN_END_AGE - MIN_TENURE
          ? `At ${n} the loan must end by ${LOAN_END_AGE}, under ${MIN_TENURE} years. A younger joint applicant could be the main borrower.`
          : undefined;
  return (
    <MoneyField
      id="bank-age"
      label="Your age"
      hint={`Loans run up to ${MAX_TENURE} years and must end by age ${LOAN_END_AGE}.`}
      prefix=""
      suffix="years"
      placeholder="Needed"
      maxLength={2}
      value={shown}
      error={error}
      onChange={(raw) => {
        setDraft(raw);
        const v = Number(raw);
        if (raw.trim() !== "" && Number.isInteger(v) && v >= 18 && v <= 80) homelander.setProfileField("age", v);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

/** The three things a bank asks that Uncle doesn't, plus anything Uncle missed that the check can't run without. */
export function BankQuestions({ profile, prefs }: { profile: Profile; prefs: BankPrefs }) {
  const missingCore = profile.grossRM === undefined || profile.age === undefined;
  const open =
    [prefs.employment, prefs.jobTenure, prefs.citizenship, profile.firstHome].filter((v) => v === undefined).length +
    (missingCore ? 1 : 0);
  return (
    <PixPanel className="grid gap-4 p-5" aria-labelledby="bank-q-title">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="bank-q-title" className="font-pixel text-xl leading-tight">
            What the bank will ask
          </h2>
          <p className="text-sm text-ink-soft">
            {open > 0
              ? `Uncle didn't cover ${open === 1 ? "this one" : `these ${open}`}. Every bank checks it.`
              : "All answered. Change any of them and the banks update."}
          </p>
        </div>
        {open > 0 ? <PixTag tone="kaya">{open} to go</PixTag> : <PixTag tone="pandan">Done</PixTag>}
      </div>

      {missingCore ? (
        <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          {profile.grossRM === undefined ? (
            <ProfileMoney k="grossRM" profile={profile} label="Monthly gross salary" required hint="Before EPF and tax." />
          ) : null}
          {profile.age === undefined ? <ProfileAge profile={profile} /> : null}
        </div>
      ) : null}

      <Segmented
        id="bank-employment"
        label="How you're paid"
        value={prefs.employment}
        options={employmentOptions}
        onChange={(employment) => setPrefs({ employment })}
        needed
        hint={
          prefs.employment === "self_employed"
            ? "Banks average your Form B; we count 80% of it."
            : prefs.employment === "commission"
              ? "Banks average your last 6 months; we count 75% of it."
              : undefined
        }
      />
      <Segmented
        id="bank-job"
        label={prefs.employment === "self_employed" ? "Business running for" : "In this job for"}
        value={prefs.jobTenure}
        options={jobOptions}
        onChange={(jobTenure) => setPrefs({ jobTenure })}
        needed
      />
      <Segmented
        id="bank-citizen"
        label="Citizenship"
        value={prefs.citizenship}
        options={citizenOptions}
        onChange={(citizenship) => setPrefs({ citizenship })}
        needed
        hint="Some loans are for Malaysians only."
      />
      <Segmented
        id="bank-first"
        label="Is this your first home?"
        value={profile.firstHome === undefined ? undefined : profile.firstHome ? "yes" : "no"}
        options={[
          { value: "yes", label: "Yes, first home" },
          { value: "no", label: "No" },
        ]}
        onChange={(v) => homelander.setProfileField("firstHome", v === "yes")}
        needed
        hint="First-home schemes and the i-MILIKI stamp duty waiver depend on it."
      />
    </PixPanel>
  );
}

/** Everything Uncle heard about money, editable. Edits save to the buyer's profile. */
export function YourNumbers({ profile }: { profile: Profile }) {
  const card = profile.cardBalanceRM;
  const takeHomeOver =
    profile.takeHomeRM !== undefined && profile.grossRM !== undefined && profile.takeHomeRM > profile.grossRM
      ? "Take-home can't be more than gross. Fix it, or clear it and we'll estimate."
      : undefined;
  return (
    <PixPanel className="grid gap-5 p-5" aria-labelledby="bank-numbers-title">
      <div className="grid gap-1">
        <h2 id="bank-numbers-title" className="font-pixel text-xl leading-tight">
          What Uncle heard
        </h2>
        <p className="text-sm text-ink-soft">From your chat with Uncle. Fix anything here; it saves to your profile.</p>
      </div>

      <fieldset className="grid gap-4">
        <legend className="mb-3 font-pixel text-base leading-none">Your pay</legend>
        <ProfileMoney k="grossRM" profile={profile} label="Monthly gross salary" required hint="Before EPF and tax." />
        <ProfileMoney
          k="takeHomeRM"
          profile={profile}
          label="Take-home pay"
          hint="Blank: we estimate it (EPF 11%, SOCSO, rough PCB)."
          extraError={takeHomeOver}
        />
        <ProfileMoney
          k="otherIncomeRM"
          profile={profile}
          label="Other fixed income"
          hint="Allowances or rental. Banks count about 80%."
        />
        <PixSwitch
          id="bank-joint"
          label="Joint applicant"
          checked={profile.joint ?? false}
          onChange={(joint) => homelander.setProfileField("joint", joint)}
        />
        {profile.joint ? (
          <ProfileMoney
            k="jointGrossRM"
            profile={profile}
            label="Their monthly gross"
            hint="We estimate their take-home the same way."
          />
        ) : null}
      </fieldset>

      <fieldset className="grid gap-4 border-t-2 border-dashed border-ink/15 pt-4">
        <legend className="mb-3 font-pixel text-base leading-none">Loans you pay each month</legend>
        <div className="grid grid-cols-2 gap-3 [&>*]:min-w-0">
          <ProfileMoney k="carRM" profile={profile} label="Car loan" />
          <ProfileMoney k="ptptnRM" profile={profile} label="PTPTN" />
          <ProfileMoney k="personalRM" profile={profile} label="Personal loan" />
          <ProfileMoney k="housingRM" profile={profile} label="Other home loan" />
        </div>
        <ProfileMoney
          k="cardBalanceRM"
          profile={profile}
          label="Credit card balance owed"
          hint={
            card
              ? `Banks count 5% of it a month: ${rm(cardMinimum(card))}.`
              : "The total owed. Banks count 5% of it each month."
          }
        />
      </fieldset>

      <fieldset className="grid gap-4 border-t-2 border-dashed border-ink/15 pt-4">
        <legend className="mb-3 font-pixel text-base leading-none">You</legend>
        <ProfileAge profile={profile} />
        <ProfileMoney
          k="savingsRM"
          profile={profile}
          label="Savings for the down payment"
          hint="Total, not monthly. We check it covers the cash upfront."
        />
      </fieldset>
    </PixPanel>
  );
}
