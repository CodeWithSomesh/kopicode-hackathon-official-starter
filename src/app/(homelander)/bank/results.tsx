"use client";

import { UnitPhoto } from "@/components/homelander/unit-photo";
import Link from "next/link";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import {
  HIGH_DSR,
  INCOME_BANDS,
  MIN_TENURE,
  OTHER_INCOME_COUNTED,
  bankEstimates,
  debtToClear,
  homeFit,
  type BankVerdict,
  type Eligibility,
  type HomeStatus,
  type IncomeInput,
} from "@/lib/homelander/bank";
import { MARGIN, rm, townshipById, units, type Unit } from "@/lib/homelander/data";
import { homelander, useHomeLander } from "@/lib/homelander/store";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import { coin } from "./fields";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const HONEST = "Estimates, not a loan offer. Banks check CCRIS/CTOS too.";

/* ---------------------------------------------------------------- empty state */

export function ResultsEmpty() {
  const t = useT();
  return (
    <PixPanel className="grid justify-items-start gap-3 p-5">
      <Sprite art="bank" scale={5} className="text-ink-soft" />
      <p className="font-pixel text-4xl leading-none text-ink-soft/60 tabular-nums">RM ---,---</p>
      <p className="max-w-prose text-sm text-ink-soft">
        {t("Fill in your pay, or scan the sample payslip, and the bank will tell you how much gold it is likely to lend.")}
      </p>
    </PixPanel>
  );
}

/* ---------------------------------------------------------------- headline */

export function Summary({ e }: { e: Eligibility }) {
  const t = useT();
  const clear = debtToClear(e);
  const zero = e.maxLoanRM <= 0;
  return (
    <PixPanel className="grid gap-4 p-5" aria-live="polite">
      <div className="grid gap-2">
        <h2 className="font-pixel text-lg leading-tight">{t("You can borrow up to")}</h2>
        <p className="flex items-center gap-3 font-pixel text-4xl leading-none font-bold tabular-nums sm:text-5xl">
          <Sprite art={coin} scale={4} className="shrink-0" />
          {rm(e.maxLoanRM)}
        </p>
        {zero ? (
          <p className="text-sm">
            {e.tenureYears < MIN_TENURE
              ? t("The loan has to end by age 70, which leaves under {n} years. Most banks won't lend that short.", { n: MIN_TENURE })
              : t("Your loans already use {a} of take-home, over the {b} most banks allow. Paying off about {c} a month of debt gets you back in the game.", { a: pct(e.dsrNow), b: pct(e.dsr), c: rm(clear) })}
          </p>
        ) : (
          <p className="text-sm">
            {t("That buys a home up to")} <strong className="tabular-nums">{rm(e.maxPriceRM)}</strong>{" "}
            {t("with a {pct}% loan (first home). Instalment up to", { pct: Math.round(MARGIN * 100) })}{" "}
            <strong className="tabular-nums">{rm(e.maxInstalmentRM)}</strong>{" "}
            {t("a month over {n} years at {rate}% (sample rate).", { n: e.tenureYears, rate: (e.rate * 100).toFixed(1) })}
          </p>
        )}
      </div>

      <DsrGauge e={e} />

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t-2 border-dashed border-ink/20 pt-3 text-sm">
        <dt>{e.jointNetRM > 0 ? t("Gross income (both of you)") : t("Gross income")}</dt>
        <dd className="text-right tabular-nums">{rm(e.grossRM)}</dd>
        <dt>
          {t("Take-home counted")}
          <span className="block text-xs text-ink-soft">
            {e.takeHomeEstimated
              ? t("Estimate: EPF {a}, SOCSO+EIS {b}, PCB about {c}", { a: rm(e.mainBreakdown.epfRM), b: rm(e.mainBreakdown.socsoRM), c: rm(e.mainBreakdown.pcbRM) })
              : t("Your take-home as typed")}
            {e.jointNetRM > 0 ? t("; joint applicant about {amount}", { amount: rm(e.jointNetRM) }) : ""}
            {e.otherCountedRM > 0 ? t("; other income at {pct}%", { pct: Math.round(OTHER_INCOME_COUNTED * 100) }) : ""}
          </span>
        </dt>
        <dd className="text-right tabular-nums">{rm(e.netRM)}</dd>
        <dt>{t("Loans you already pay")}</dt>
        <dd className="text-right tabular-nums">{rm(e.commitmentsRM)}</dd>
        <dt>{t("Loan tenure")}</dt>
        <dd className="text-right tabular-nums">{t("{n} years", { n: e.tenureYears })}</dd>
      </dl>
      <p className="text-xs font-medium text-ink-soft">{t(HONEST)}</p>
    </PixPanel>
  );
}

/** DSR bar in 5% blocks with 60% and 70% marks. */
function DsrGauge({ e }: { e: Eligibility }) {
  const t = useT();
  const now = Math.min(e.dsrNow, 1);
  const room = Math.max(e.dsr - now, 0);
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-pixel text-base leading-none">{t("Debt service ratio")}</h3>
        <p className="text-sm tabular-nums">
          {t("{pct} used now", { pct: pct(e.dsrNow) })}
        </p>
      </div>
      <div className="relative pb-6">
        <div
          role="meter"
          aria-label={t("Debt service ratio before the home loan")}
          aria-valuenow={Math.round(e.dsrNow * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={t("{a} of take-home already goes to loans. Most banks allow {b}, some up to {c}.", { a: pct(e.dsrNow), b: pct(e.dsr), c: pct(HIGH_DSR) })}
          className="flex gap-[3px] bg-ink p-[3px]"
        >
          {Array.from({ length: 20 }, (_, i) => {
            const mid = (i + 0.5) / 20;
            return (
              <span
                key={i}
                className={cn(
                  "h-5 flex-1",
                  mid < now ? "bg-raya" : mid < e.dsr ? "bg-pandan" : mid < HIGH_DSR ? "bg-kaya" : "bg-ink-soft/50",
                )}
              />
            );
          })}
        </div>
        {[e.dsr, HIGH_DSR].map((m) => (
          <span
            key={m}
            aria-hidden
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `calc(3px + ${m} * (100% - 6px))` }}
          >
            <span className="h-[34px] w-[3px] bg-ink" />
            <span className="font-pixel-label text-[10px] leading-none">{pct(m)}</span>
          </span>
        ))}
      </div>
      <ul className="grid gap-1 text-xs text-ink-soft sm:grid-cols-3">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 shrink-0 bg-raya" /> {t("Loans now {pct}", { pct: pct(now) })}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 shrink-0 bg-pandan" /> {t("Room for a home {pct}", { pct: pct(room) })}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 shrink-0 bg-kaya" /> {t("Some banks, to {pct}", { pct: pct(HIGH_DSR) })}
        </li>
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- five banks */

const verdictTone: Record<BankVerdict, { tone: "pandan" | "kaya" | "raya"; label: string }> = {
  yes: { tone: "pandan", label: "Likely yes" },
  maybe: { tone: "kaya", label: "Maybe" },
  no: { tone: "raya", label: "Likely no" },
};

export function BankTable({
  input,
  target,
  onTarget,
}: {
  input: IncomeInput;
  target: Unit;
  onTarget: (id: string) => void;
}) {
  const t = useT();
  const rows = bankEstimates(input, target.priceRM);
  return (
    <PixPanel className="grid gap-3 p-5">
      <div className="grid gap-2">
        <h2 className="font-pixel text-lg leading-tight">{t("What five banks might say")}</h2>
        <label htmlFor="bank-target" className="text-sm">
          {t("For this home")}
        </label>
        <div className="pix-frame pix-flat focus-within:outline-[3px] focus-within:outline-offset-[6px] focus-within:outline-kaya focus-within:outline-solid">
          <select
            id="bank-target"
            value={target.id}
            onChange={(ev) => onTarget(ev.target.value)}
            className="h-11 w-full bg-transparent px-3 text-sm font-medium focus-visible:outline-none"
          >
            {[...units]
              .sort((a, b) => a.priceRM - b.priceRM)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}, {rm(u.priceRM)}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[420px] text-sm">
          <caption className="sr-only">
            {t("Sample estimate per bank for {name}: assumed DSR ceiling, maximum loan and likely answer", { name: target.name })}
          </caption>
          <thead>
            <tr className="text-left text-xs text-ink-soft">
              <th scope="col" className="py-1.5 pr-2 font-normal">{t("Bank")}</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-normal">{t("DSR cap")}</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-normal">{t("Rate")}</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-normal">{t("Max loan")}</th>
              <th scope="col" className="py-1.5 text-right font-normal">{t("This home")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bank.id} className="border-t-2 border-ink/10">
                <th scope="row" className="py-2 pr-2 text-left font-medium">{r.bank.name}</th>
                <td className="py-2 pr-2 text-right tabular-nums">{pct(r.ceiling)}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{(r.bank.rate * 100).toFixed(2)}%</td>
                <td className="py-2 pr-2 text-right tabular-nums">{rm(r.maxLoanRM)}</td>
                <td className="py-2 text-right">
                  <PixTag tone={verdictTone[r.verdict].tone}>{t(verdictTone[r.verdict].label)}</PixTag>
                  <span className="block pt-0.5 text-xs text-ink-soft tabular-nums">
                    {Number.isFinite(r.dsrWithHome) ? t("DSR {pct}", { pct: pct(r.dsrWithHome) }) : t("Tenure too short")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-soft">
        {t("Sample assumptions, not the banks' published criteria. Caps change by take-home band (under {a}, up to {b}, above). Likely yes leaves 5 points of room under the cap; maybe is within 5 points.", { a: rm(INCOME_BANDS[0]), b: rm(INCOME_BANDS[1]) })}{" "}
        {t(HONEST)}
      </p>
    </PixPanel>
  );
}

/* ---------------------------------------------------------------- homes */

const statusTag: Record<HomeStatus, { tone: "pandan" | "kaya" | "raya"; label: string }> = {
  in: { tone: "pandan", label: "In range" },
  stretch: { tone: "kaya", label: "Stretch" },
  out: { tone: "raya", label: "Out of range" },
};

export function HomesInRange({ e }: { e: Eligibility }) {
  const t = useT();
  const { liked, compare } = useHomeLander();
  const list = units
    .map((u) => ({ u, fit: homeFit(u.priceRM, e) }))
    .sort((a, b) => a.u.priceRM - b.u.priceRM);
  const counts = { in: 0, stretch: 0, out: 0 };
  list.forEach((x) => counts[x.fit.status]++);

  return (
    <section aria-labelledby="homes-title" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="homes-title" className="font-pixel text-2xl leading-none">
          {t("Homes in your range")}
        </h2>
        <p className="text-sm text-ink tabular-nums">
          {t("{a} in range, {b} stretch, {c} out of range", { a: counts.in, b: counts.stretch, c: counts.out })}
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map(({ u, fit }) => {
          const isLiked = liked.includes(u.id);
          const inBattle = compare.includes(u.id);
          return (
            <li key={u.id}>
              <PixPanel flat className="grid h-full gap-3 p-3">
                <div className="flex gap-3">
                  <UnitPhoto
                    photo={u.photo}
                    unoptimized
                    alt=""
                    width={72}
                    height={72}
                    className="pix-img size-[72px] shrink-0 border-[3px] border-ink object-cover"
                  />
                  <div className="grid min-w-0 content-start gap-1">
                    <PixTag tone={statusTag[fit.status].tone} className="justify-self-start">
                      {t(statusTag[fit.status].label)}
                    </PixTag>
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-ink-soft">{townshipById[u.townshipId]?.name}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-soft">{t("Price")}</dt>
                    <dd className="text-sm font-medium tabular-nums">{rm(u.priceRM)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">{t("Monthly")}</dt>
                    <dd className="text-sm font-medium tabular-nums">{rm(fit.instalmentRM)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">{t("Left each month")}</dt>
                    <dd className={cn("text-sm font-medium tabular-nums", fit.leftRM < 1_500 && "text-raya-deep")}>
                      {rm(fit.leftRM)}
                    </dd>
                  </div>
                </dl>
                {fit.status !== "in" && e.maxPriceRM > 0 ? (
                  <p className="text-xs text-ink-soft tabular-nums">{t("{amount} over your limit", { amount: rm(u.priceRM - e.maxPriceRM) })}</p>
                ) : null}
                <div className="mt-auto flex gap-3 pt-1">
                  <PixButton
                    type="button"
                    size="sm"
                    tone={isLiked ? "raya" : "white"}
                    aria-pressed={isLiked}
                    onClick={() => (isLiked ? homelander.unlike(u.id) : homelander.like(u.id))}
                    className="flex-1"
                  >
                    <Sprite art="heart" scale={2} className={isLiked ? "text-white" : "text-raya"} />
                    {isLiked ? t("Liked") : t("Like")}
                  </PixButton>
                  <PixButton asChild size="sm" tone="lilac" className="flex-1">
                    <Link
                      href="/battle"
                      onClick={() =>
                        homelander.setCompare([...compare.filter((x) => x !== u.id), u.id].slice(-3))
                      }
                    >
                      <Sprite art="bars" scale={2} />
                      {inBattle ? t("In battle") : t("Battle")}
                    </Link>
                  </PixButton>
                </div>
              </PixPanel>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-soft">
        {t("Monthly is a {pct}% loan over {n} years at {rate}% (sample rate). Left each month is take-home minus every loan, before food, bills and nasi lemak. Stretch means up to 10% over your limit. Prices are sample data.", { pct: Math.round(MARGIN * 100), n: e.tenureYears, rate: (e.rate * 100).toFixed(1) })}{" "}
        {t(HONEST)}
      </p>
    </section>
  );
}
