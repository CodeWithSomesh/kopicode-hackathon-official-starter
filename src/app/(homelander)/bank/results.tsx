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
import { rm, townshipById, type Unit } from "@/lib/homelander/data";
import { useT } from "@/lib/homelander/i18n/client";
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
  const t = useT();
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
      <span className="sr-only"> ({t("opens in a new tab")})</span>
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
  const t = useT();
  const [draft, setDraft] = useState<string | null>(null);
  const typing = target?.kind === "price" || (homes.length === 0 && !target);
  const priceShown = draft ?? (target?.kind === "price" ? target.priceRM.toLocaleString("en-MY") : "");
  return (
    <PixPanel className="grid gap-3 p-4 sm:p-5" aria-labelledby="bank-target-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="bank-target-title" className="font-pixel text-xl leading-tight">
          {t("The home to check")}
        </h2>
        {targetPriceRM ? <p className="font-pixel text-lg tabular-nums">{rm(targetPriceRM)}</p> : null}
      </div>
      {homes.length ? (
        <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pt-1 pb-2" aria-label={t("Your liked and compared homes")}>
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
              {t("Type a price")}
            </button>
          </li>
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">
          {t("No liked homes yet. Type a price, or")}{" "}
          <Link href="/swipe" className="font-medium text-ink underline underline-offset-2">
            {t("swipe some homes")}
          </Link>{" "}
          {t("and pick one here.")}
        </p>
      )}
      {typing || draft !== null ? (
        <div className="grid gap-1.5">
          <label htmlFor="bank-price" className="text-sm font-medium">
            {t("Home price")}
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
          <p className="text-xs text-ink-soft">{t("From RM50,000. We update the banks as you type.")}</p>
        </div>
      ) : targetUnit ? (
        <p className="text-xs text-ink-soft">
          {t("{type}, {beds} bed, {sqft} sq ft in {town}.", { type: targetUnit.type, beds: targetUnit.beds, sqft: targetUnit.builtUpSqft.toLocaleString("en-MY"), town: townshipById[targetUnit.townshipId]?.name ?? "" })}
          {targetUnit.source === "sample" ? ` ${t("Sample price.")}` : ""}
        </p>
      ) : null}
    </PixPanel>
  );
}

/* ---------------------------------------------------------------- the result card */

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
  const tr = useT();
  const r = top.best;
  const look = verdictLook[r.verdict];
  const t = r.target;
  const cash = t ? cashUpfront(t.priceRM, t.loanRM, firstHome) : null;
  const gap = cash && savingsRM !== null ? cash.totalRM - savingsRM : null;
  const today = new Date().toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  const [copied, setCopied] = useState(false);

  const summary = [
    tr("HomeLander bank check, {date}", { date: today }),
    tr("Best match: {bank}, {product} ({verdict})", { bank: top.lender.name, product: r.product.name, verdict: tr(look.label) }),
    t ? tr("Home: {name} at {amt}", { name: targetUnit?.name ?? tr("Typed price"), amt: rm(t.priceRM) }) : null,
    t ? tr("Loan {loan} ({margin}), {inst} a month over {years} years at {rate}", { loan: rm(t.loanRM), margin: pct(t.margin), inst: rm(t.instalmentRM), years: r.tenureYears, rate: ratePct(r.rate) }) : null,
    t ? tr("DSR with this home {dsr} (bank cap {cap})", { dsr: pct(t.dsrWithHome), cap: pct(r.dsrCap) }) : null,
    tr("Max loan {loan}, homes up to {price}", { loan: rm(r.maxLoanRM), price: rm(r.maxPriceRM) }),
    tr(HONEST),
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <article aria-labelledby="bank-card-title" className="relative">
      <PixPanel className="overflow-hidden p-0">
        {/* Jade band: the bank and the verdict. */}
        <div className="flex items-start justify-between gap-3 bg-pandan-deep px-5 pt-4 pb-3.5 text-white">
          <div className="grid min-w-0 gap-1">
            <p className="text-xs text-white/80">{tr("Your best match of {n} banks", { n: lenders.length })}</p>
            <h2 id="bank-card-title" className="truncate font-pixel text-2xl leading-none sm:text-3xl">
              {top.lender.name}
            </h2>
            <p className="truncate text-sm text-white/90">
              {r.product.name} · {r.product.category === "islamic" ? tr("Islamic") : tr("Conventional")} ·{" "}
              {r.product.type === "flexi" ? tr("Flexi") : tr("Term")}
            </p>
          </div>
          <PixTag tone={look.tone} className="shrink-0">
            {tr(look.label)}
          </PixTag>
        </div>

        <div className="grid gap-5 p-5">
          {t ? (
            <div className="flex items-center gap-3">
              {targetUnit ? (
                <UnitPhoto
                  photo={targetUnit.photo}
                  unoptimized
                  alt=""
                  width={64}
                  height={64}
                  className="pix-img size-16 shrink-0 rounded-[10px] border-2 border-ink object-cover"
                />
              ) : (
                <span className="flex size-16 shrink-0 items-center justify-center rounded-[10px] border-2 border-ink bg-cloud">
                  <Sprite art="house" scale={4} className="text-ink" />
                </span>
              )}
              <div className="grid min-w-0 gap-0.5">
                <p className="truncate font-medium">{targetUnit?.name ?? tr("The home you typed")}</p>
                <p className="text-sm text-ink-soft tabular-nums">
                  {rm(t.priceRM)} · {tr("loan")} {rm(t.loanRM)} ({pct(t.margin)})
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-1">
            <p className="text-sm text-ink-soft">{t ? tr("Monthly instalment") : tr("You could borrow up to")}</p>
            <p className="flex items-center gap-3 font-pixel text-5xl leading-none tabular-nums sm:text-6xl">
              <Sprite art={coin} scale={4} className="shrink-0" />
              {t ? rm(t.instalmentRM) : rm(r.maxLoanRM)}
            </p>
            <p className="text-sm text-ink tabular-nums">
              {t
                ? tr("{years} years at {rate}. If rates rise {pct}%, {amt}.", { years: r.tenureYears, rate: ratePct(r.rate), pct: Math.round(STRESS_RATE * 100), amt: rm(t.stressInstalmentRM) })
                : tr("Homes up to {amt}, {years} years at {rate}.", { amt: rm(r.maxPriceRM), years: r.tenureYears, rate: ratePct(r.rate) })}
            </p>
          </div>

          {t ? <DsrBar dsr={t.dsrWithHome} cap={r.dsrCap} nowShare={k.netRM > 0 ? (t.dsrWithHome * k.netRM - t.instalmentRM) / k.netRM : 0} /> : null}

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border-2 border-ink bg-ink sm:grid-cols-3">
            <Stat label={tr("Max loan")} value={rm(r.maxLoanRM)} />
            <Stat label={tr("Max home price")} value={rm(r.maxPriceRM)} />
            <Stat label={tr("Take-home counted")} value={rm(k.netRM)} />
            {t ? <Stat label={tr("Left each month")} value={rm(t.leftRM)} warn={t.leftRM < 1_500} /> : null}
            {cash ? (
              <Stat
                label={cash.exempt ? tr("Cash upfront (no stamp duty)") : tr("Cash upfront")}
                value={rm(cash.totalRM)}
                warn={gap !== null && gap > 0}
              />
            ) : null}
            {cash ? (
              <Stat
                label={tr("Your savings")}
                value={savingsRM === null ? tr("Not told") : gap !== null && gap > 0 ? tr("{amt} short", { amt: rm(gap) }) : rm(savingsRM)}
                warn={gap !== null && gap > 0}
              />
            ) : null}
          </dl>

          {r.reasons.length ? (
            <ul className="grid gap-1.5 text-sm">
              {r.reasons.map((x) => (
                <li key={x} className="flex gap-2">
                  <span aria-hidden className={cn("mt-1.5 size-2 shrink-0", look.bar)} />
                  {tr(x)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">
              {tr("Passes this bank's age, income and citizenship rules, with room under its {cap} DSR cap.", { cap: pct(r.dsrCap) })}
            </p>
          )}

          <div className="flex flex-wrap gap-3 p-1">
            <PixButton asChild tone="pandan" size="md">
              <Out href={top.lender.officialUrl}>{tr("Visit {name}", { name: top.lender.name })}</Out>
            </PixButton>
            <PixButton asChild size="md">
              <Out href={r.product.ringgitPlusUrl}>{tr("This loan on RinggitPlus")}</Out>
            </PixButton>
            <PixButton
              type="button"
              size="md"
              tone="sky"
              onClick={() => {
                void navigator.clipboard?.writeText(summary).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
                window.setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? tr("Copied") : tr("Copy summary")}
            </PixButton>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-dashed border-ink/20 pt-3 text-xs text-ink-soft">
            <span>{tr("HomeLander bank check")} · {today}</span>
            <span className="font-medium">{tr(HONEST)}</span>
          </footer>
        </div>
      </PixPanel>
    </article>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="grid min-w-0 gap-0.5 bg-[var(--j-surface,white)] px-3 py-2.5">
      <dt className="truncate text-xs text-ink-soft">{label}</dt>
      <dd className={cn("font-pixel text-base leading-tight tabular-nums sm:text-lg", warn && "text-raya-deep")}>{value}</dd>
    </div>
  );
}

/** DSR with the new home, in 5% blocks, with the bank's cap marked. */
function DsrBar({ dsr, cap, nowShare }: { dsr: number; cap: number; nowShare: number }) {
  const t = useT();
  const shown = Math.min(dsr, 1);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{t("Debt service ratio with this home")}</span>
        <span className={cn("font-pixel text-lg tabular-nums", dsr > cap && "text-raya-deep")}>{pct(dsr)}</span>
      </div>
      <div className="relative pb-5">
        <div
          role="meter"
          aria-label={t("Debt service ratio with this home")}
          aria-valuenow={Math.round(dsr * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={t("{dsr} of take-home goes to loans, against this bank's {cap} cap", { dsr: pct(dsr), cap: pct(cap) })}
          className="flex gap-[3px] rounded-[6px] bg-ink p-[3px]"
        >
          {Array.from({ length: 20 }, (_, i) => {
            const mid = (i + 0.5) / 20;
            return (
              <span
                key={i}
                className={cn(
                  "h-4 flex-1 first:rounded-l-[3px] last:rounded-r-[3px]",
                  mid < nowShare ? "bg-teh" : mid < shown ? (shown > cap ? "bg-raya" : shown > cap - DSR_BUFFER ? "bg-kaya" : "bg-pandan") : "bg-ink-soft/40",
                )}
              />
            );
          })}
        </div>
        <span
          aria-hidden
          className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `calc(3px + ${cap} * (100% - 6px))` }}
        >
          <span className="h-[28px] w-[3px] bg-ink" />
          <span className="text-[10px] leading-none font-medium">{t("cap {cap}", { cap: pct(cap) })}</span>
        </span>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 bg-teh" /> {t("Loans you pay now")}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 bg-pandan" /> {t("This home")}
        </li>
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- every bank */

type Cat = "all" | "conventional" | "islamic";
type Kind = "all" | "flexi" | "term";

export function BankList({ banks, k, hasTarget }: { banks: BankResult[]; k: Counted; hasTarget: boolean }) {
  const t = useT();
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
  const counts = { likely: 0, borderline: 0, unlikely: 0 };
  rows.forEach((b) => counts[b.best.verdict]++);
  const band = incomeBand(k.netRM);

  return (
    <section aria-labelledby="bank-list-title" className="grid gap-4">
      <PixPanel flat className="grid gap-3 p-4">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h2 id="bank-list-title" className="font-pixel text-2xl leading-none">
            {t("Every bank, best first")}
          </h2>
          <p className="text-sm tabular-nums">
            <span className="font-medium text-pandan-deep">{t("{n} likely", { n: counts.likely })}</span> ·{" "}
            <span className="font-medium text-kaya-deep">{t("{n} borderline", { n: counts.borderline })}</span> ·{" "}
            <span className="font-medium text-raya-deep">{t("{n} unlikely", { n: counts.unlikely })}</span>
          </p>
        </div>
        <VerdictStrip counts={counts} />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("Filter loans")}>
        {(
          [
            ["all", "All"],
            ["conventional", "Conventional"],
            ["islamic", "Islamic"],
          ] as const
        ).map(([v, label]) => (
          <Chip key={v} on={cat === v} onClick={() => setCat(v)}>
            {t(label)}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 w-px self-stretch bg-ink/15" />
        {(
          [
            ["all", "Any type"],
            ["flexi", "Flexi"],
            ["term", "Term"],
          ] as const
        ).map(([v, label]) => (
          <Chip key={v} on={kind === v} onClick={() => setKind(v)}>
            {t(label)}
          </Chip>
        ))}
      </div>
      </PixPanel>

      <ol className="grid gap-3">
        {rows.map((b, i) => (
          <li key={b.lender.id}>
            <BankRow rank={i + 1} b={b} band={band} hasTarget={hasTarget} />
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-soft">
        {t("Rates and loan conditions as listed by RinggitPlus when the MYHomeMath template was built; check today's rate with the bank. DSR caps are our sample assumptions by take-home band (under {a}, {a} to {b}, above).", { a: rm(INCOME_BANDS[0]), b: rm(INCOME_BANDS[1]) })} {t(HONEST)}
      </p>
    </section>
  );
}

function VerdictStrip({ counts }: { counts: Record<Verdict, number> }) {
  const total = counts.likely + counts.borderline + counts.unlikely || 1;
  return (
    <div aria-hidden className="flex h-3 gap-[3px] overflow-hidden rounded-[6px] bg-ink p-[3px]">
      {(["likely", "borderline", "unlikely"] as const).map((v) =>
        counts[v] ? (
          <span key={v} className={cn("rounded-[3px]", verdictLook[v].bar)} style={{ flex: counts[v] / total }} />
        ) : null,
      )}
    </div>
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

function BankRow({ rank, b, band, hasTarget }: { rank: number; b: BankResult; band: number; hasTarget: boolean }) {
  const tr = useT();
  const r = b.best;
  const look = verdictLook[r.verdict];
  const t = r.target;
  return (
    <PixPanel flat className="overflow-hidden p-0">
      <div className="flex">
        <span aria-hidden className={cn("w-2 shrink-0", look.bar)} />
        <div className="grid min-w-0 flex-1 gap-3 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink font-pixel text-base text-white tabular-nums">
              {rank}
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="font-pixel text-lg leading-tight">{b.lender.name}</h3>
                <PixTag tone={look.tone}>{tr(look.label)}</PixTag>
              </div>
              <p className="truncate text-sm text-ink-soft">
                {r.product.name} · {r.product.category === "islamic" ? tr("Islamic") : tr("Conventional")} ·{" "}
                {r.product.type === "flexi" ? tr("Flexi") : tr("Term")}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            {hasTarget ? (
              <Fig label="Monthly" value={t ? rm(t.instalmentRM) : "n/a"} strong />
            ) : (
              <Fig label="Max loan" value={rm(r.maxLoanRM)} strong />
            )}
            <Fig label="Rate" value={ratePct(r.rate)} />
            {hasTarget ? (
              <Fig
                label="DSR / cap"
                value={t ? `${pct(t.dsrWithHome)} / ${pct(r.dsrCap)}` : pct(r.dsrCap)}
                warn={!!t && t.dsrWithHome > r.dsrCap}
              />
            ) : (
              <Fig label="DSR cap" value={pct(r.dsrCap)} />
            )}
            <Fig label="Max home price" value={rm(r.maxPriceRM)} />
          </dl>

          {r.reasons.length ? (
            <p className="text-sm">
              <span className="sr-only">{tr("Why")}: </span>
              {r.reasons.slice(0, 2).map((x) => tr(x)).join(". ")}.
            </p>
          ) : null}

          <details className="group">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium underline underline-offset-2 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-kaya focus-visible:outline-solid [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="inline-flex transition-transform group-open:rotate-90">
                <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><path d="M0 0l8 5-8 5z" /></svg>
              </span>
              {b.others.length
                ? tr(b.others.length === 1 ? "Assumptions and {n} more loan" : "Assumptions and {n} more loans", { n: b.others.length })
                : tr("Assumptions")}
            </summary>
            <div className="mt-3 grid gap-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-[10px] bg-cloud p-3 text-sm sm:grid-cols-4">
                <div className="grid gap-0.5">
                  <dt className="text-xs text-ink-soft">{tr("DSR cap by take-home")}</dt>
                  <dd className="tabular-nums">
                    {b.lender.dsrCaps.map((c, i) => (
                      <span key={i} className={cn(i === band ? "font-bold" : "text-ink-soft")}>
                        {pct(c)}
                        {i < 2 ? " / " : ""}
                      </span>
                    ))}
                  </dd>
                </div>
                <Fig label="Margin" value={t ? pct(t.margin) : r.product.firstHomeScheme ? tr("90%, 100% to {amt}", { amt: rm(SCHEME_PRICE_CAP) }) : "90%"} />
                <Fig label="Tenure" value={tr("{n} yrs (max {max}, to age {age})", { n: r.tenureYears, max: MAX_TENURE, age: LOAN_END_AGE })} />
                <Fig
                  label="Min income"
                  value={r.product.minAnnualIncomeRM ? tr("{amt}/yr", { amt: rm(r.product.minAnnualIncomeRM) }) : tr("Not listed")}
                />
                <Fig label="Age to apply" value={tr("{a} to {b}", { a: r.product.minAge, b: r.product.maxAge })} />
                <Fig
                  label="Who"
                  value={
                    r.product.citizens.length === 3
                      ? tr("Any nationality")
                      : r.product.citizens.length === 2
                        ? tr("Malaysians, PRs")
                        : tr("Malaysians")
                  }
                />
                <Fig label="Rate tiers" value={r.product.tiers.map((x) => ratePct(x.rate)).join(", ")} />
                <Fig label="Loan range" value={loanRange(r, tr)} />
              </dl>
              {r.product.notes.length ? <p className="text-xs text-ink-soft">{r.product.notes.map((x) => tr(x)).join(". ")}.</p> : null}

              {b.others.length ? (
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="w-full min-w-[440px] text-sm">
                    <caption className="sr-only">{tr("Other {name} loans for you", { name: b.lender.name })}</caption>
                    <thead>
                      <tr className="text-left text-xs text-ink-soft">
                        <th scope="col" className="py-1 pr-2 font-normal">{tr("Loan")}</th>
                        <th scope="col" className="py-1 pr-2 text-right font-normal">{tr("Rate")}</th>
                        <th scope="col" className="py-1 pr-2 text-right font-normal">{hasTarget ? tr("Monthly") : tr("Max loan")}</th>
                        <th scope="col" className="py-1 text-right font-normal">{tr("Verdict")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.others.map((o) => (
                        <tr key={o.product.id} className="border-t-2 border-ink/10 align-top">
                          <th scope="row" className="py-2 pr-2 text-left font-medium">
                            <Out href={o.product.ringgitPlusUrl} className="underline underline-offset-2">
                              {o.product.name}
                            </Out>
                            {o.reasons[0] ? (
                              <span className="block text-xs font-normal text-ink-soft">{tr(o.reasons[0])}</span>
                            ) : null}
                          </th>
                          <td className="py-2 pr-2 text-right tabular-nums">{ratePct(o.rate)}</td>
                          <td className="py-2 pr-2 text-right tabular-nums">
                            {hasTarget ? (o.target ? rm(o.target.instalmentRM) : tr("n/a")) : rm(o.maxLoanRM)}
                          </td>
                          <td className="py-2 text-right">
                            <PixTag tone={verdictLook[o.verdict].tone}>{tr(verdictLook[o.verdict].label)}</PixTag>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </details>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Out href={b.lender.officialUrl} className="font-medium text-pandan-deep underline underline-offset-2">
              {tr("{name} official site", { name: b.lender.name })}
            </Out>
            <Out href={r.product.ringgitPlusUrl} className="font-medium underline underline-offset-2">
              {tr("{name} on RinggitPlus", { name: r.product.name })}
            </Out>
          </div>
        </div>
      </div>
    </PixPanel>
  );
}

function loanRange(r: ProductResult, tr: (en: string, v?: Record<string, string | number>) => string) {
  const lo = Math.min(...r.product.tiers.map((x) => x.minLoanRM));
  const his = r.product.tiers.map((x) => x.maxLoanRM);
  const hi = his.includes(null) ? null : Math.max(...(his as number[]));
  return hi === null ? tr("From {lo}", { lo: rm(lo) }) : tr("{a} to {b}", { a: rm(lo), b: rm(hi) });
}

function Fig({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  const t = useT();
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-xs text-ink-soft">{t(label)}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "font-pixel text-lg leading-tight" : "font-medium",
          warn && "text-raya-deep",
        )}
      >
        {t(value)}
      </dd>
    </div>
  );
}

/* ---------------------------------------------------------------- next steps */

export function NextSteps({ inRange, top }: { inRange: Unit | null; top: BankResult }) {
  const t = useT();
  return (
    <PixPanel className="grid grid-cols-1 gap-4 p-5" aria-labelledby="bank-next-title">
      <h2 id="bank-next-title" className="font-pixel text-xl leading-tight">
        {t("Where to go from here")}
      </h2>
      <ol className="grid gap-3 text-sm">
        <li className="flex gap-3">
          <Num n={1} />
          <span>
            {t("Read {name}'s home-loan terms on their", { name: top.lender.name })}{" "}
            <Out href={top.lender.officialUrl} className="font-medium underline underline-offset-2">
              {t("official site")}
            </Out>{" "}
            {t("and ask for today's rate.")}
          </span>
        </li>
        <li className="flex gap-3">
          <Num n={2} />
          <span>
            {t("Compare more loans on")}{" "}
            <Out href={RINGGITPLUS_HOME_LOANS} className="font-medium underline underline-offset-2">
              RinggitPlus
            </Out>{" "}
            {t("and read")}{" "}
            <Out href={PROPERTYGURU_HOME_LOANS} className="font-medium underline underline-offset-2">
              {t("PropertyGuru's home-loan guides")}
            </Out>
            .
          </span>
        </li>
        <li className="flex gap-3">
          <Num n={3} />
          <span>
            {t("Get your free CCRIS report from Bank Negara and check CTOS before you apply, so nothing surprises the bank.")}
          </span>
        </li>
      </ol>
      {inRange ? (
        <div className="p-1">
          <PixButton asChild tone="kaya" size="lg" className="w-full max-w-full sm:w-auto">
            <Link href={`/homes/${inRange.id}/feng-shui`}>
              <Sprite art="sparkle" scale={2} className="shrink-0" />
              <span className="min-w-0 truncate">{t("Feng Shui check: {name}", { name: inRange.name })}</span>
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
  const t = useT();
  return (
    <section aria-labelledby="bank-how-title" className="grid gap-3 md:grid-cols-2">
      <h2 id="bank-how-title" className="sr-only">
        {t("How the estimate works")}
      </h2>
      <PixPanel flat className="p-5">
        <details>
          <summary className="cursor-pointer font-pixel text-lg leading-tight">{t("How we work it out")}</summary>
          <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm">
            <li>
              {k.recognised < 1
                ? t("Income a bank counts: your take-home (at {pct}, as your pay varies), a joint applicant's take-home, and 80% of fixed allowances or rental. Now", { pct: pct(k.recognised) })
                : t("Income a bank counts: your take-home, a joint applicant's take-home, and 80% of fixed allowances or rental. Now")}{" "}
              <strong className="tabular-nums">{rm(k.netRM)}</strong> {t("a month.")}
            </li>
            <li>
              {t("Each bank lets all your loans, the new one included, use up to its DSR cap of that income. What's left after your current loans is the most the new instalment can be.")}
            </li>
            <li>
              {t("That instalment, at the loan's own rate tier, over {years} years (up to {max}, ending by age {age}), gives the biggest loan. It can't go outside the loan's listed range.", { years: k.tenureYears, max: MAX_TENURE, age: LOAN_END_AGE })}
            </li>
            <li>
              {t("Max home price is that loan over the margin: 90% for a first or second home loan, up to 100% on first-home schemes for homes to {amt}.", { amt: rm(SCHEME_PRICE_CAP) })}
            </li>
            <li>
              {t("Likely yes passes the loan's rules with {n} points to spare under the cap. Borderline is inside the last {n} points, or a new job. Unlikely breaks a rule.", { n: Math.round(DSR_BUFFER * 100) })}
            </li>
          </ol>
        </details>
      </PixPanel>
      <PixPanel flat className="p-5">
        <details>
          <summary className="cursor-pointer font-pixel text-lg leading-tight">{t("What to bring to the bank")}</summary>
          <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm">
            <li>{t("IC (or passport) copy")}</li>
            <li>{t("Last 3 months' payslips, plus the latest EA form or EPF statement")}</li>
            <li>{t("Last 6 months' bank statements showing your salary going in")}</li>
            <li>{t("New in the job: your offer or confirmation letter (most banks want 3 months in service)")}</li>
            <li>{t("Self-employed: business registration, 6 months' statements, Form B and accounts for 2 years")}</li>
            <li>{t("The booking receipt or offer letter from the developer")}</li>
          </ul>
          <p className="mt-3 text-xs text-ink-soft">
            {t("Loan must end by age {age}; most banks won't lend under {min} years.", { age: LOAN_END_AGE, min: MIN_TENURE })}
          </p>
        </details>
      </PixPanel>
    </section>
  );
}

/* ---------------------------------------------------------------- empty states */

export function NeedAnswers({ open }: { open: string[] }) {
  const t = useT();
  return (
    <PixPanel className="grid justify-items-start gap-3 p-6">
      <Sprite art="bank" scale={5} className="text-ink-soft" />
      <p className="font-pixel text-4xl leading-none text-ink-soft/50 tabular-nums">RM ---,---</p>
      <p className="max-w-prose text-sm">
        {t(open.length === 1 ? "Answer one more question and we'll check all {n} banks for you: {list}." : "Answer {q} more questions and we'll check all {n} banks for you: {list}.", { q: open.length, n: lenders.length, list: open.map((o) => t(o)).join(", ").toLowerCase() })}
      </p>
    </PixPanel>
  );
}
