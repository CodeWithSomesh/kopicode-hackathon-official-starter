"use client";

import Link from "next/link";
import { useState } from "react";
import { UnitPhoto } from "@/components/homelander/unit-photo";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import {
  DSR_BUFFER,
  INCOME_BANDS,
  LOAN_END_AGE,
  MAX_TENURE,
  MIN_TENURE,
  SCHEME_PRICE_CAP,
  STRESS_RATE,
  cashUpfront,
  incomeBand,
  type BankResult,
  type Counted,
  type ProductResult,
  type Verdict,
} from "@/lib/homelander/bank";
import { PROPERTYGURU_HOME_LOANS, RINGGITPLUS_HOME_LOANS, lenders } from "@/lib/homelander/banks-data";
import { monthlyInstalment, rm, townshipById, type Unit } from "@/lib/homelander/data";
import { cn } from "@/lib/utils";
import { coin } from "./fields";
import { setPrefs, type Target } from "./prefs";

export const HONEST = "Estimates, not a loan offer. Banks also check your CCRIS and CTOS records.";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ratePct = (r: number) => `${(r * 100).toFixed(2)}%`;

export const verdictLook: Record<Verdict, { tone: "pandan" | "kaya" | "raya"; label: string; bar: string }> = {
  likely: { tone: "pandan", label: "Likely yes", bar: "bg-pandan" },
  borderline: { tone: "kaya", label: "Borderline", bar: "bg-kaya" },
  unlikely: { tone: "raya", label: "Unlikely", bar: "bg-raya" },
};

/** External link: new tab, no referrer. */
function Out({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/* ---------------------------------------------------------------- target home */

export function TargetPicker({
  homes,
  target,
  targetUnit,
  targetPriceRM,
}: {
  homes: Unit[];
  target: Target | undefined;
  targetUnit: Unit | null;
  targetPriceRM: number | null;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const typing = target?.kind === "price" || (homes.length === 0 && !target);
  const priceShown = draft ?? (target?.kind === "price" ? target.priceRM.toLocaleString("en-MY") : "");
  return (
    <PixPanel className="grid gap-3 p-4 sm:p-5" aria-labelledby="bank-target-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="bank-target-title" className="font-pixel text-xl leading-tight">
          The home to check
        </h2>
        {targetPriceRM ? <p className="font-pixel text-lg tabular-nums">{rm(targetPriceRM)}</p> : null}
      </div>
      {homes.length ? (
        <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pt-1 pb-2" aria-label="Your liked and compared homes">
          {homes.map((u) => {
            const on = targetUnit?.id === u.id;
            return (
              <li key={u.id} className="snap-start">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setDraft(null);
                    setPrefs({ target: { kind: "home", id: u.id } });
                  }}
                  className={cn(
                    "pix-frame pix-flat flex w-52 items-center gap-2.5 p-2 text-left",
                    "focus-visible:outline-[3px] focus-visible:outline-offset-[6px] focus-visible:outline-kaya focus-visible:outline-solid",
                  )}
                  style={on ? ({ "--pix-fill": "var(--color-ink)" } as React.CSSProperties) : undefined}
                >
                  <UnitPhoto
                    photo={u.photo}
                    unoptimized
                    alt=""
                    width={48}
                    height={48}
                    className="pix-img size-12 shrink-0 rounded-[8px] object-cover"
                  />
                  <span className={cn("grid min-w-0 gap-0.5", on ? "text-white" : "text-ink")}>
                    <span className="truncate text-sm font-medium">{u.name}</span>
                    <span className={cn("text-xs tabular-nums", on ? "text-white/80" : "text-ink-soft")}>
                      {rm(u.priceRM)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          <li className="snap-start">
            <button
              type="button"
              aria-pressed={typing}
              onClick={() => {
                setDraft("");
                window.setTimeout(() => document.getElementById("bank-price")?.focus(), 30);
              }}
              className={cn(
                "pix-frame pix-flat flex h-full min-h-16 w-36 items-center justify-center p-2 text-sm font-medium",
                "focus-visible:outline-[3px] focus-visible:outline-offset-[6px] focus-visible:outline-kaya focus-visible:outline-solid",
              )}
              style={typing ? ({ "--pix-fill": "var(--color-ink)", color: "white" } as React.CSSProperties) : undefined}
            >
              Type a price
            </button>
          </li>
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">
          No liked homes yet. Type a price, or{" "}
          <Link href="/swipe" className="font-medium text-ink underline underline-offset-2">
            swipe some homes
          </Link>{" "}
          and pick one here.
        </p>
      )}
      {typing || draft !== null ? (
        <div className="grid gap-1.5">
          <label htmlFor="bank-price" className="text-sm font-medium">
            Home price
          </label>
          <div className="pix-frame pix-flat flex h-12 items-center gap-2 px-3 focus-within:outline-[3px] focus-within:outline-offset-[6px] focus-within:outline-kaya focus-within:outline-solid">
            <span className="font-pixel text-lg text-ink-soft">RM</span>
            <input
              id="bank-price"
              inputMode="numeric"
              autoComplete="off"
              placeholder="650,000"
              value={priceShown}
              onChange={(e) => {
                setDraft(e.target.value);
                const n = Number(e.target.value.replace(/[,\s]/g, "").replace(/^RM/i, ""));
                if (Number.isFinite(n) && n >= 50_000 && n <= 20_000_000) setPrefs({ target: { kind: "price", priceRM: n } });
              }}
              onBlur={() => setDraft(null)}
              className="h-full w-0 min-w-0 flex-1 bg-transparent text-lg font-medium tabular-nums focus-visible:outline-none"
            />
          </div>
          <p className="text-xs text-ink-soft">From RM50,000. We update the banks as you type.</p>
        </div>
      ) : targetUnit ? (
        <p className="text-xs text-ink-soft">
          {targetUnit.type}, {targetUnit.beds} bed, {targetUnit.builtUpSqft.toLocaleString("en-MY")} sq ft in{" "}
          {townshipById[targetUnit.townshipId]?.name}.{targetUnit.source === "sample" ? " Sample price." : ""}
        </p>
      ) : null}
    </PixPanel>
  );
}

/* ---------------------------------------------------------------- the result card */

/** Plain-text summary for the Copy button. */
export function summaryText(top: BankResult, targetUnit: Unit | null) {
  const r = top.best;
  const t = r.target;
  const today = new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  return [
    `HomeLander bank check, ${today}`,
    `Best match: ${top.lender.name}, ${r.product.name} (${verdictLook[r.verdict].label})`,
    t ? `Home: ${targetUnit?.name ?? "Typed price"} at ${rm(t.priceRM)}` : null,
    t ? `Loan ${rm(t.loanRM)} (${pct(t.margin)}), ${rm(t.instalmentRM)} a month over ${r.tenureYears} years at ${ratePct(r.rate)}` : null,
    t ? `DSR with this home ${pct(t.dsrWithHome)} (bank cap ${pct(r.dsrCap)})` : null,
    `Max loan ${rm(r.maxLoanRM)}, homes up to ${rm(r.maxPriceRM)}`,
    HONEST,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The best bank for the home being checked: instalment, DSR with the home, and the cash needed. */
export function ResultCard({
  top,
  k,
  targetUnit,
  savingsRM,
  firstHome,
}: {
  top: BankResult;
  k: Counted;
  targetUnit: Unit | null;
  savingsRM: number | null;
  firstHome: boolean;
}) {
  const r = top.best;
  const look = verdictLook[r.verdict];
  const t = r.target;
  if (!t) return null;
  const cash = cashUpfront(t.priceRM, t.loanRM, firstHome);
  const gap = savingsRM !== null ? cash.totalRM - savingsRM : null;

  return (
    <article aria-labelledby="bank-card-title">
      <PixPanel className="grid gap-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {targetUnit ? (
              <UnitPhoto
                photo={targetUnit.photo}
                unoptimized
                alt=""
                width={56}
                height={56}
                className="pix-img size-14 shrink-0 rounded-[12px] object-cover"
              />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-[12px] bg-cloud">
                <Sprite art="house" scale={3} className="text-ink" />
              </span>
            )}
            <div className="grid min-w-0 gap-0.5">
              <p className="text-xs text-ink-soft">Best match for this home</p>
              <h2 id="bank-card-title" className="truncate font-pixel text-xl leading-tight">
                {top.lender.name}
              </h2>
              <p className="truncate text-xs text-ink-soft">
                {r.product.name} · {targetUnit?.name ?? "The price you typed"}
              </p>
            </div>
          </div>
          <PixTag tone={look.tone} className="shrink-0">
            {look.label}
          </PixTag>
        </div>

        <div className="grid gap-1">
          <p className="text-sm text-ink-soft">Monthly instalment</p>
          <p className="flex items-center gap-3 font-pixel text-5xl leading-none tabular-nums">
            <Sprite art={coin} scale={4} className="shrink-0" />
            {rm(t.instalmentRM)}
          </p>
          <p className="text-sm text-ink-soft tabular-nums">
            Loan {rm(t.loanRM)} ({pct(t.margin)}) over {r.tenureYears} years at {ratePct(r.rate)}. If rates rise{" "}
            {Math.round(STRESS_RATE * 100)}%, {rm(t.stressInstalmentRM)}.
          </p>
        </div>

        <DsrBar dsr={t.dsrWithHome} cap={r.dsrCap} nowShare={k.netRM > 0 ? (t.dsrWithHome * k.netRM - t.instalmentRM) / k.netRM : 0} />

        <dl className="grid grid-cols-1 gap-3 rounded-[12px] bg-cloud p-4 sm:grid-cols-3">
          <Stat label="Left each month" value={rm(t.leftRM)} warn={t.leftRM < 1_500} />
          <Stat label={cash.exempt ? "Cash upfront (no stamp duty)" : "Cash upfront"} value={rm(cash.totalRM)} warn={gap !== null && gap > 0} />
          <Stat
            label="Your savings"
            value={savingsRM === null ? "Not told" : gap !== null && gap > 0 ? `${rm(gap)} short` : rm(savingsRM)}
            warn={gap !== null && gap > 0}
          />
        </dl>

        {r.reasons.length ? (
          <ul className="grid gap-1.5 text-sm">
            {r.reasons.map((x) => (
              <li key={x} className="flex gap-2">
                <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", look.bar)} />
                {x}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-3 p-1">
          <PixButton asChild tone="pandan" size="md">
            <Out href={top.lender.officialUrl}>Visit {top.lender.name}</Out>
          </PixButton>
          <PixButton asChild size="md">
            <Out href={r.product.ringgitPlusUrl}>This loan on RinggitPlus</Out>
          </PixButton>
        </div>
        <p className="text-xs text-ink-soft">{HONEST}</p>
      </PixPanel>
    </article>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="truncate text-xs text-ink-soft">{label}</dt>
      <dd className={cn("font-pixel text-lg leading-tight tabular-nums", warn && "text-raya-deep")}>{value}</dd>
    </div>
  );
}

/** DSR with the new home: loans paid now, then this home, with the bank's limit marked. */
function DsrBar({ dsr, cap, nowShare }: { dsr: number; cap: number; nowShare: number }) {
  const now = Math.max(Math.min(nowShare, 1), 0);
  const home = Math.max(Math.min(dsr, 1) - now, 0);
  const over = dsr > cap;
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-ink-soft">Debt service ratio with this home</span>
        <span className="tabular-nums">
          <span className={cn("font-pixel text-lg", over && "text-raya-deep")}>{pct(dsr)}</span>
          <span className="text-ink-soft"> of {pct(cap)} limit</span>
        </span>
      </div>
      <div
        role="img"
        aria-label={`${pct(dsr)} of take-home goes to loans, against this bank's ${pct(cap)} limit`}
        className="relative flex h-2.5 rounded-full bg-cloud"
      >
        <span className="h-full rounded-l-full bg-teh" style={{ width: `${now * 100}%` }} />
        <span
          className={cn("h-full", over ? "bg-raya" : "bg-ink-soft", now === 0 && "rounded-l-full")}
          style={{ width: `${home * 100}%` }}
        />
        <span aria-hidden className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink" style={{ left: `calc(${cap * 100}% - 1px)` }} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-teh" /> Loans you pay now
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-full", over ? "bg-raya" : "bg-ink-soft")} /> This home
        </li>
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- every bank */

type Cat = "all" | "conventional" | "islamic";
type Kind = "all" | "flexi" | "term";

/** Two-letter monogram for a bank: "Public Bank" → PB, "Maybank" → MA. */
function monogram(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  const s = words.length > 1 ? words[0]![0]! + words[1]![0]! : name.slice(0, 2);
  return s.toUpperCase();
}

const kindLine = (r: ProductResult) =>
  `${r.product.category === "islamic" ? "Islamic" : "Conventional"} · ${r.product.type === "flexi" ? "Flexi" : "Term"}`;

export function BankList({
  banks,
  k,
  hasTarget,
  toolbar,
}: {
  banks: BankResult[];
  k: Counted;
  hasTarget: boolean;
  /** Extra controls for the toolbar (the tenure picker). */
  toolbar?: React.ReactNode;
}) {
  const [cat, setCat] = useState<Cat>("all");
  const [kind, setKind] = useState<Kind>("all");
  const rows = banks
    .map((b) => {
      const list = [b.best, ...b.others].filter(
        (r) => (cat === "all" || r.product.category === cat) && (kind === "all" || r.product.type === kind),
      );
      return list[0] ? { lender: b.lender, best: list[0], others: list.slice(1) } : null;
    })
    .filter((x): x is BankResult => x !== null);
  const canApply = rows.filter((b) => b.best.verdict !== "unlikely");
  const notFit = rows.filter((b) => b.best.verdict === "unlikely");
  const likely = canApply.filter((b) => b.best.verdict === "likely").length;
  const band = incomeBand(k.netRM);
  const dsrNow = k.netRM > 0 ? k.e.commitmentsRM / k.netRM : 1;

  return (
    <section aria-labelledby="bank-list-title" className="grid gap-5">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="bank-list-title" className="font-pixel text-2xl leading-none">
            Banks you can apply to
          </h2>
          <p className="text-sm text-ink-soft tabular-nums">
            {canApply.length} of {rows.length} · {likely} likely, {canApply.length - likely} borderline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter loans">
          {(
            [
              ["all", "All"],
              ["conventional", "Conventional"],
              ["islamic", "Islamic"],
            ] as const
          ).map(([v, label]) => (
            <Chip key={v} on={cat === v} onClick={() => setCat(v)}>
              {label}
            </Chip>
          ))}
          <span aria-hidden className="mx-1 h-6 w-px bg-[var(--j-line)]" />
          {(
            [
              ["all", "Any type"],
              ["flexi", "Flexi"],
              ["term", "Term"],
            ] as const
          ).map(([v, label]) => (
            <Chip key={v} on={kind === v} onClick={() => setKind(v)}>
              {label}
            </Chip>
          ))}
          {toolbar ? <div className="ml-auto">{toolbar}</div> : null}
        </div>
        <p className="text-xs text-ink-soft">Estimates from listed rates, not loan offers. Banks decide after checking CCRIS and CTOS.</p>
      </div>

      {canApply.length ? (
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {canApply.map((b, i) => (
            <li key={b.lender.id} className="min-w-0">
              <BankCard b={b} band={band} hasTarget={hasTarget} dsrNow={dsrNow} best={i === 0} />
            </li>
          ))}
        </ol>
      ) : (
        <PixPanel flat className="grid gap-2 p-5">
          <p className="font-pixel text-lg leading-tight">No bank is a fit right now</p>
          <p className="text-sm text-ink-soft">
            {hasTarget
              ? "Try a lower price or a shorter list of loans you pay, and the banks update as you change them."
              : "The reasons are under each bank below. Clearing a loan or adding a joint applicant usually helps most."}
          </p>
        </PixPanel>
      )}

      {notFit.length ? <NotAFit banks={notFit} /> : null}

      <p className="text-xs text-ink-soft">
        Rates and loan conditions as listed by RinggitPlus when the MYHomeMath template was built; check today&apos;s
        rate with the bank. DSR limits are our sample assumptions by take-home band (under {rm(INCOME_BANDS[0])},{" "}
        {rm(INCOME_BANDS[0])} to {rm(INCOME_BANDS[1])}, above). {HONEST}
      </p>
    </section>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full border-2 border-ink px-3 text-sm font-medium",
        "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-kaya focus-visible:outline-solid",
        on ? "bg-ink text-white" : "bg-[var(--j-surface,white)] text-ink hover:bg-cloud",
      )}
    >
      {children}
    </button>
  );
}

function Monogram({ name, small }: { name: string; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-cloud font-pixel-label text-ink",
        small ? "size-8 text-[10px]" : "size-11 text-xs",
      )}
    >
      {monogram(name)}
    </span>
  );
}

function BankCard({
  b,
  band,
  hasTarget,
  dsrNow,
  best,
}: {
  b: BankResult;
  band: number;
  hasTarget: boolean;
  dsrNow: number;
  best: boolean;
}) {
  const r = b.best;
  const look = verdictLook[r.verdict];
  const t = r.target;
  // Instalment on the biggest loan (no target), or on this home's loan.
  const monthly = t ? t.instalmentRM : r.maxLoanRM > 0 ? monthlyInstalment(r.maxLoanRM, r.rate, r.tenureYears) : 0;
  const yours = t ? t.dsrWithHome : dsrNow;
  return (
    <PixPanel flat className="flex h-full flex-col overflow-hidden p-0">
      <span aria-hidden className={cn("h-1 shrink-0", look.bar)} />
      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex items-start gap-3">
          <Monogram name={b.lender.name} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <h3 className="font-pixel text-lg leading-tight">{b.lender.name}</h3>
            <p className="truncate text-xs text-ink-soft">{r.product.name}</p>
          </div>
          <PixTag tone={look.tone} className="shrink-0">
            {look.label}
          </PixTag>
        </div>

        <div className="grid gap-1">
          <p className="text-xs text-ink-soft">
            {best ? <span className="font-semibold text-pandan-deep">Best match · </span> : null}
            {hasTarget ? "Monthly for this home" : "You could borrow"}
          </p>
          <p className="font-pixel text-3xl leading-none tabular-nums">
            {hasTarget ? (t ? rm(t.instalmentRM) : "n/a") : rm(r.maxLoanRM)}
          </p>
          <p className="text-xs text-ink-soft tabular-nums">
            {t ? `Loan ${rm(t.loanRM)} (${pct(t.margin)}) · homes up to ${rm(r.maxPriceRM)}` : `Homes up to ${rm(r.maxPriceRM)}`}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-3">
          {hasTarget ? (
            <Fig label="Max loan" value={rm(r.maxLoanRM)} />
          ) : (
            <Fig label="Est. monthly" value={rm(monthly)} />
          )}
          <Fig label="Rate" value={ratePct(r.rate)} />
          <Fig label="Tenure" value={`${r.tenureYears} yrs`} />
        </dl>

        <DsrLine yours={yours} cap={r.dsrCap} withHome={!!t} />

        {r.reasons.length ? (
          <p className="text-sm">
            <span className="sr-only">Why borderline: </span>
            {r.reasons.slice(0, 2).join(". ")}.
          </p>
        ) : null}

        <div className="mt-auto grid gap-3 border-t border-[var(--j-line)] pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Out href={b.lender.officialUrl} className="font-medium text-pandan-deep underline underline-offset-2">
              Official site
            </Out>
            <Out href={r.product.ringgitPlusUrl} className="font-medium underline underline-offset-2">
              On RinggitPlus
            </Out>
          </div>
          <LoanDetails b={b} band={band} hasTarget={hasTarget} />
        </div>
      </div>
    </PixPanel>
  );
}

/** Their DSR against this bank's limit: a slim track, a fill, and a tick at the limit. */
function DsrLine({ yours, cap, withHome }: { yours: number; cap: number; withHome: boolean }) {
  const over = yours > cap;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-ink-soft">{withHome ? "DSR with this home" : "Your DSR now"}</span>
        <span className="tabular-nums">
          <span className={cn("font-semibold", over && "text-raya-deep")}>{pct(yours)}</span>
          <span className="text-ink-soft"> of {pct(cap)} limit</span>
        </span>
      </div>
      <div aria-hidden className="relative h-1.5 rounded-full bg-cloud">
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", over ? "bg-raya" : "bg-ink-soft")}
          style={{ width: `${Math.min(yours, 1) * 100}%` }}
        />
        <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-ink" style={{ left: `calc(${cap * 100}% - 1px)` }} />
      </div>
    </div>
  );
}

function LoanDetails({ b, band, hasTarget }: { b: BankResult; band: number; hasTarget: boolean }) {
  const r = b.best;
  const t = r.target;
  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm text-ink-soft hover:text-ink focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-kaya focus-visible:outline-solid [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-flex transition-transform group-open:rotate-90">
          <svg width="7" height="9" viewBox="0 0 8 10" fill="currentColor">
            <path d="M0 0l8 5-8 5z" />
          </svg>
        </span>
        Loan details{b.others.length ? ` and ${b.others.length} more ${b.others.length === 1 ? "loan" : "loans"}` : ""}
      </summary>
      <div className="mt-3 grid gap-4">
        <p className="text-xs text-ink-soft">{kindLine(r)}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="grid gap-0.5">
            <dt className="text-xs text-ink-soft">DSR limit by take-home</dt>
            <dd className="tabular-nums">
              {b.lender.dsrCaps.map((c, i) => (
                <span key={i} className={cn(i === band ? "font-semibold" : "text-ink-soft")}>
                  {pct(c)}
                  {i < 2 ? " / " : ""}
                </span>
              ))}
            </dd>
          </div>
          <Fig label="Margin" value={t ? pct(t.margin) : r.product.firstHomeScheme ? `90%, 100% to ${rm(SCHEME_PRICE_CAP)}` : "90%"} />
          <Fig label="Tenure" value={`${r.tenureYears} yrs (max ${MAX_TENURE}, to age ${LOAN_END_AGE})`} />
          <Fig label="Min income" value={r.product.minAnnualIncomeRM ? `${rm(r.product.minAnnualIncomeRM)}/yr` : "Not listed"} />
          <Fig label="Age to apply" value={`${r.product.minAge} to ${r.product.maxAge}`} />
          <Fig
            label="Who"
            value={
              r.product.citizens.length === 3 ? "Any nationality" : r.product.citizens.length === 2 ? "Malaysians, PRs" : "Malaysians"
            }
          />
          <Fig label="Rate tiers" value={r.product.tiers.map((x) => ratePct(x.rate)).join(", ")} />
          <Fig label="Loan range" value={loanRange(r)} />
        </dl>
        {r.product.notes.length ? <p className="text-xs text-ink-soft">{r.product.notes.join(". ")}.</p> : null}

        {b.others.length ? (
          <div className="grid gap-2">
            <p className="text-xs text-ink-soft">Other {b.lender.name} loans</p>
            <ul className="grid divide-y divide-[var(--j-line)] text-sm">
              {b.others.map((o) => (
                <li key={o.product.id} className="grid gap-1 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <Out href={o.product.ringgitPlusUrl} className="min-w-0 font-medium underline underline-offset-2">
                      {o.product.name}
                    </Out>
                    <PixTag tone={verdictLook[o.verdict].tone} className="shrink-0">
                      {verdictLook[o.verdict].label}
                    </PixTag>
                  </div>
                  <p className="text-xs text-ink-soft tabular-nums">
                    {ratePct(o.rate)} ·{" "}
                    {hasTarget ? (o.target ? `${rm(o.target.instalmentRM)} a month` : "n/a") : `up to ${rm(o.maxLoanRM)}`}
                    {o.reasons[0] ? ` · ${o.reasons[0]}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

/** Banks the buyer can't apply to today, collapsed, each with the main reason. */
function NotAFit({ banks }: { banks: BankResult[] }) {
  return (
    <PixPanel flat className="p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-[14px] px-5 py-4 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-kaya focus-visible:outline-solid [&::-webkit-details-marker]:hidden">
          <span className="grid gap-0.5">
            <span className="font-pixel text-lg leading-tight">Not a fit right now</span>
            <span className="text-sm text-ink-soft">
              {banks.length} {banks.length === 1 ? "bank" : "banks"}, each with the reason
            </span>
          </span>
          <span aria-hidden className="inline-flex text-ink-soft transition-transform group-open:rotate-180">
            <svg width="12" height="12" viewBox="0 0 10 10">
              <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
        </summary>
        <ul className="grid divide-y divide-[var(--j-line)] border-t border-[var(--j-line)]">
          {banks.map((b) => (
            <li key={b.lender.id} className="flex items-start gap-3 px-5 py-3.5">
              <Monogram name={b.lender.name} small />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-medium">{b.lender.name}</p>
                  <p className="text-xs text-ink-soft tabular-nums">{ratePct(b.best.rate)}</p>
                </div>
                <p className="text-sm text-ink-soft">{b.best.reasons[0] ?? "Doesn't meet this bank's rules"}</p>
                <div className="flex flex-wrap gap-x-4 text-xs">
                  <Out href={b.lender.officialUrl} className="underline underline-offset-2">
                    Official site
                  </Out>
                  <Out href={b.best.product.ringgitPlusUrl} className="underline underline-offset-2">
                    {b.best.product.name}
                  </Out>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </PixPanel>
  );
}

function loanRange(r: ProductResult) {
  const lo = Math.min(...r.product.tiers.map((x) => x.minLoanRM));
  const his = r.product.tiers.map((x) => x.maxLoanRM);
  const hi = his.includes(null) ? null : Math.max(...(his as number[]));
  return hi === null ? `From ${rm(lo)}` : `${rm(lo)} to ${rm(hi)}`;
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------- next steps */

export function NextSteps({ inRange, top }: { inRange: Unit | null; top: BankResult }) {
  return (
    <PixPanel className="grid grid-cols-1 gap-4 p-5" aria-labelledby="bank-next-title">
      <h2 id="bank-next-title" className="font-pixel text-xl leading-tight">
        Where to go from here
      </h2>
      <ol className="grid gap-3 text-sm">
        <li className="flex gap-3">
          <Num n={1} />
          <span>
            Read {top.lender.name}&apos;s home-loan terms on their{" "}
            <Out href={top.lender.officialUrl} className="font-medium underline underline-offset-2">
              official site
            </Out>{" "}
            and ask for today&apos;s rate.
          </span>
        </li>
        <li className="flex gap-3">
          <Num n={2} />
          <span>
            Compare more loans on{" "}
            <Out href={RINGGITPLUS_HOME_LOANS} className="font-medium underline underline-offset-2">
              RinggitPlus
            </Out>{" "}
            and read{" "}
            <Out href={PROPERTYGURU_HOME_LOANS} className="font-medium underline underline-offset-2">
              PropertyGuru&apos;s home-loan guides
            </Out>
            .
          </span>
        </li>
        <li className="flex gap-3">
          <Num n={3} />
          <span>
            Get your free CCRIS report from Bank Negara and check CTOS before you apply, so nothing surprises the
            bank.
          </span>
        </li>
      </ol>
      {inRange ? (
        <div className="p-1">
          <PixButton asChild tone="kaya" size="lg" className="w-full max-w-full sm:w-auto">
            <Link href={`/homes/${inRange.id}/feng-shui`}>
              <Sprite art="sparkle" scale={2} className="shrink-0" />
              <span className="min-w-0 truncate">Feng Shui check: {inRange.name}</span>
            </Link>
          </PixButton>
        </div>
      ) : null}
    </PixPanel>
  );
}

function Num({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
      {n}
    </span>
  );
}

/* ---------------------------------------------------------------- how it works */

export function HowItWorks({ k }: { k: Counted }) {
  return (
    <section aria-labelledby="bank-how-title" className="grid gap-3 md:grid-cols-2">
      <h2 id="bank-how-title" className="sr-only">
        How the estimate works
      </h2>
      <PixPanel flat className="p-5">
        <details>
          <summary className="cursor-pointer font-pixel text-lg leading-tight">How we work it out</summary>
          <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm">
            <li>
              Income a bank counts: your take-home{k.recognised < 1 ? ` (at ${pct(k.recognised)}, as your pay varies)` : ""},
              a joint applicant&apos;s take-home, and 80% of fixed allowances or rental. Now{" "}
              <strong className="tabular-nums">{rm(k.netRM)}</strong> a month.
            </li>
            <li>
              Each bank lets all your loans, the new one included, use up to its DSR cap of that income. What&apos;s left
              after your current loans is the most the new instalment can be.
            </li>
            <li>
              That instalment, at the loan&apos;s own rate tier, over {k.tenureYears} years (up to {MAX_TENURE}, ending by
              age {LOAN_END_AGE}), gives the biggest loan. It can&apos;t go outside the loan&apos;s listed range.
            </li>
            <li>
              Max home price is that loan over the margin: 90% for a first or second home loan, up to 100% on first-home
              schemes for homes to {rm(SCHEME_PRICE_CAP)}.
            </li>
            <li>
              Likely yes passes the loan&apos;s rules with {Math.round(DSR_BUFFER * 100)} points to spare under the cap.
              Borderline is inside the last {Math.round(DSR_BUFFER * 100)} points, or a new job. Unlikely breaks a rule.
            </li>
          </ol>
        </details>
      </PixPanel>
      <PixPanel flat className="p-5">
        <details>
          <summary className="cursor-pointer font-pixel text-lg leading-tight">What to bring to the bank</summary>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm">
            <li>IC (or passport) copy</li>
            <li>Last 3 months&apos; payslips, plus the latest EA form or EPF statement</li>
            <li>Last 6 months&apos; bank statements showing your salary going in</li>
            <li>New in the job: your offer or confirmation letter (most banks want 3 months in service)</li>
            <li>Self-employed: business registration, 6 months&apos; statements, Form B and accounts for 2 years</li>
            <li>The booking receipt or offer letter from the developer</li>
          </ul>
          <p className="mt-3 text-xs text-ink-soft">
            Loan must end by age {LOAN_END_AGE}; most banks won&apos;t lend under {MIN_TENURE} years.
          </p>
        </details>
      </PixPanel>
    </section>
  );
}

/* ---------------------------------------------------------------- empty states */

export function NeedAnswers({ open }: { open: string[] }) {
  return (
    <PixPanel className="grid justify-items-start gap-3 p-6">
      <Sprite art="bank" scale={5} className="text-ink-soft" />
      <p className="font-pixel text-4xl leading-none text-ink-soft/50 tabular-nums">RM ---,---</p>
      <p className="max-w-prose text-sm">
        Answer {open.length === 1 ? "one more question" : `${open.length} more questions`} and we&apos;ll check all {lenders.length}{" "}
        banks for you: {open.join(", ").toLowerCase()}.
      </p>
    </PixPanel>
  );
}
