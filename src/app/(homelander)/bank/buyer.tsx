"use client";

import Link from "next/link";
import { useState } from "react";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import {
  cardMinimum,
  monthlyCommitments,
  takeHomeEstimate,
  type BankResult,
  type Counted,
} from "@/lib/homelander/bank";
import { rm } from "@/lib/homelander/data";
import { toIncomeInput, type Profile } from "@/lib/homelander/profile";
import { cn } from "@/lib/utils";
import type { BankPrefs } from "./prefs";

const pct = (x: number) => `${Math.round(x * 100)}%`;

const livingLabel: Record<NonNullable<Profile["livingWith"]>, string> = {
  alone: "Just me",
  partner: "My partner",
  partner_kids: "Partner and kids",
  parents: "My parents",
  friends: "Friends",
  other: "Someone else",
};

const paidLabel: Record<NonNullable<BankPrefs["employment"]>, string> = {
  salaried: "Salaried",
  self_employed: "Self-employed",
  commission: "Commission",
};

const jobLabel: Record<NonNullable<BankPrefs["jobTenure"]>, string> = {
  lt6m: "Under 6 months",
  "6to12m": "6 to 12 months",
  "1to2y": "1 to 2 years",
  "2y_plus": "2 years or more",
};

const citizenLabel: Record<NonNullable<BankPrefs["citizenship"]>, string> = {
  malaysian: "Malaysian",
  pr: "Permanent resident",
  foreigner: "Foreigner",
};

const NOT_TOLD = "Not told";

/**
 * Everything we know about the buyer in one panel, with the headline result on top.
 * Phones show the headline and a toggle; the full list opens on tap. Desktop always shows it.
 */
export function BuyerPanel({
  profile,
  prefs,
  k,
  top,
  open,
  summary,
}: {
  profile: Profile;
  prefs: BankPrefs;
  k: Counted | null;
  top: BankResult | null;
  /** Answers the check still needs. */
  open: string[];
  /** Plain-text summary for the Copy button; null until there is a result. */
  summary: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const income = toIncomeInput(profile);
  const commitmentsRM = income ? monthlyCommitments(income.commitments) : null;
  const gross = profile.grossRM;
  const takeHome = profile.takeHomeRM ?? (gross !== undefined ? takeHomeEstimate(gross).netRM : undefined);
  const takeHomeEstimated = profile.takeHomeRM === undefined && gross !== undefined;
  const jointNet = profile.joint && profile.jointGrossRM ? takeHomeEstimate(profile.jointGrossRM).netRM : null;
  const best = top?.best ?? null;
  const dsrNow = k && commitmentsRM !== null && k.netRM > 0 ? commitmentsRM / k.netRM : null;
  const card = profile.cardBalanceRM;

  return (
    <PixPanel className="grid gap-0 p-0" aria-labelledby="bank-you-title">
      {/* Headline: always visible. */}
      <div className="grid gap-4 px-5 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="bank-you-title" className="font-pixel text-xl leading-tight">
            You, as the bank sees you
          </h2>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="bank-you-details"
            onClick={() => setExpanded((v) => !v)}
            className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink hover:bg-cloud focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-kaya focus-visible:outline-solid lg:hidden"
          >
            {expanded ? "Hide" : "Details"}
            <svg
              aria-hidden
              width="10"
              height="10"
              viewBox="0 0 10 10"
              className={cn("transition-transform", expanded && "rotate-180")}
            >
              <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>

        {best && k ? (
          <div className="grid gap-4">
            <div className="grid gap-1">
              <p className="text-sm text-ink-soft">You could borrow up to</p>
              <p className="font-pixel text-4xl leading-none tabular-nums">{rm(best.maxLoanRM)}</p>
              <p className="text-sm text-ink-soft">
                Best case, with {top!.lender.name} over {best.tenureYears} years.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Headline label="Max property price" value={rm(best.maxPriceRM)} />
              <Headline
                label="DSR now / limit"
                value={dsrNow === null ? "–" : `${pct(dsrNow)} / ${pct(best.dsrCap)}`}
              />
            </dl>
          </div>
        ) : (
          <div className="grid gap-1">
            <p className="font-pixel text-3xl leading-none text-ink-soft/50 tabular-nums">RM ---,---</p>
            <p className="text-sm text-ink-soft">
              {open.length
                ? `${open.length === 1 ? "One answer" : `${open.length} answers`} to go: ${open.join(", ").toLowerCase()}.`
                : "Waiting on your answers."}
            </p>
          </div>
        )}
      </div>

      {/* Full details: always on desktop, behind the toggle on phones. */}
      <div id="bank-you-details" className={cn("border-t border-[var(--j-line)]", expanded ? "block" : "hidden", "lg:block")}>
        <Section title="About you">
          <Row label="Living with" value={profile.livingWith ? livingLabel[profile.livingWith] : NOT_TOLD} />
          <Row label="Age" value={profile.age === undefined ? NOT_TOLD : `${profile.age}`} />
          <Row
            label="First home"
            value={profile.firstHome === undefined ? NOT_TOLD : profile.firstHome ? "Yes" : "No"}
          />
          <Row label="Citizenship" value={prefs.citizenship ? citizenLabel[prefs.citizenship] : NOT_TOLD} />
          <Row label="How you're paid" value={prefs.employment ? paidLabel[prefs.employment] : NOT_TOLD} />
          <Row label="In this job" value={prefs.jobTenure ? jobLabel[prefs.jobTenure] : NOT_TOLD} />
          <Row label="Savings" value={profile.savingsRM === undefined ? NOT_TOLD : rm(profile.savingsRM)} />
        </Section>

        <Section title="Income a month">
          <Row label="Gross salary" value={gross === undefined ? NOT_TOLD : rm(gross)} />
          <Row
            label="Take-home"
            value={takeHome === undefined ? NOT_TOLD : rm(takeHome)}
            note={takeHomeEstimated ? "est." : undefined}
          />
          {profile.otherIncomeRM ? <Row label="Other fixed income" value={rm(profile.otherIncomeRM)} /> : null}
          <Row
            label="Joint applicant"
            value={profile.joint ? (profile.jointGrossRM ? rm(profile.jointGrossRM) : "Amount not told") : "None"}
            note={profile.joint && profile.jointGrossRM ? "gross" : undefined}
          />
          {jointNet !== null ? <Row label="Their take-home" value={rm(jointNet)} note="est." /> : null}
          {k ? <Row label="Counted by banks" value={rm(k.netRM)} strong /> : null}
        </Section>

        <Section title="Loans you pay a month">
          <Row label="Car" value={money(profile.carRM)} />
          <Row label="PTPTN" value={money(profile.ptptnRM)} />
          <Row label="Personal" value={money(profile.personalRM)} />
          <Row
            label="Credit card"
            value={card ? rm(cardMinimum(card)) : money(card)}
            note={card ? `5% of ${rm(card)}` : undefined}
          />
          <Row label="Other home loan" value={money(profile.housingRM)} />
          {commitmentsRM !== null ? <Row label="Total" value={rm(commitmentsRM)} strong /> : null}
        </Section>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[var(--j-line)] px-5 py-3">
          {summary ? (
            <div className="p-1">
              <PixButton
                type="button"
                size="sm"
                tone="sky"
                onClick={() => {
                  void navigator.clipboard?.writeText(summary).then(
                    () => setCopied(true),
                    () => setCopied(false),
                  );
                  window.setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied" : "Copy summary"}
              </PixButton>
            </div>
          ) : null}
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2"
          >
            <Sprite art="mochi" scale={2} />
            Tell Mochi something new
          </Link>
        </div>
      </div>
    </PixPanel>
  );
}

const money = (v: number | undefined) => (v === undefined ? NOT_TOLD : v === 0 ? "None" : rm(v));

function Headline({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-[12px] bg-cloud px-3 py-2.5">
      <dt className="truncate text-xs text-ink-soft">{label}</dt>
      <dd className="font-pixel text-lg leading-tight tabular-nums">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1.5 border-t border-[var(--j-line)] px-5 py-3 first:border-t-0">
      <h3 className="font-pixel-label text-[11px] tracking-wide text-ink-soft uppercase">{title}</h3>
      <dl className="grid gap-1">{children}</dl>
    </section>
  );
}

function Row({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  const muted = value === NOT_TOLD || value === "None";
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className={cn("min-w-0", strong ? "font-medium" : "text-ink-soft")}>{label}</dt>
      <dd className={cn("shrink-0 text-right tabular-nums", strong && "font-semibold", muted && "text-ink-soft")}>
        {note ? <span className="mr-1.5 text-xs font-normal text-ink-soft">{note}</span> : null}
        {value}
      </dd>
    </div>
  );
}
