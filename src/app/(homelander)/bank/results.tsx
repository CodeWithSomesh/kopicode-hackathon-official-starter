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
import { cn } from "@/lib/utils";
import { coin } from "./fields";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const HONEST = "Estimates, not a loan offer. Banks check CCRIS/CTOS too.";

/* ---------------------------------------------------------------- empty state */

export function ResultsEmpty() {
  return (
    <PixPanel className="grid justify-items-start gap-3 p-5">
      <Sprite art="bank" scale={5} className="text-ink-soft" />
      <p className="font-pixel text-4xl leading-none text-ink-soft/60 tabular-nums">RM ---,---</p>
      <p className="max-w-prose text-sm text-ink-soft">
        Fill in your pay, or scan the sample payslip, and the bank will tell you how much gold it is likely to lend.
      </p>
    </PixPanel>
  );
}

/* ---------------------------------------------------------------- headline */

export function Summary({ e }: { e: Eligibility }) {
  const clear = debtToClear(e);
  const zero = e.maxLoanRM <= 0;
  return (
    <PixPanel className="grid gap-4 p-5" aria-live="polite">
      <div className="grid gap-2">
        <h2 className="font-pixel text-lg leading-tight">You can borrow up to</h2>
        <p className="flex items-center gap-3 font-pixel text-4xl leading-none font-bold tabular-nums sm:text-5xl">
          <Sprite art={coin} scale={4} className="shrink-0" />
          {rm(e.maxLoanRM)}
        </p>
        {zero ? (
          <p className="text-sm">
            {e.tenureYears < MIN_TENURE
              ? `The loan has to end by age 70, which leaves under ${MIN_TENURE} years. Most banks won't lend that short.`
              : `Your loans already use ${pct(e.dsrNow)} of take-home, over the ${pct(e.dsr)} most banks allow. Paying off about ${rm(clear)} a month of debt gets you back in the game.`}
          </p>
        ) : (
          <p className="text-sm">
            That buys a home up to <strong className="tabular-nums">{rm(e.maxPriceRM)}</strong> with a{" "}
            {Math.round(MARGIN * 100)}% loan (first home). Instalment up to{" "}
            <strong className="tabular-nums">{rm(e.maxInstalmentRM)}</strong> a month over {e.tenureYears} years at{" "}
            {(e.rate * 100).toFixed(1)}% (sample rate).
          </p>
        )}
      </div>

      <DsrGauge e={e} />

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 border-t-2 border-dashed border-ink/20 pt-3 text-sm">
        <dt>Gross income{e.jointNetRM > 0 ? " (both of you)" : ""}</dt>
        <dd className="text-right tabular-nums">{rm(e.grossRM)}</dd>
        <dt>
          Take-home counted
          <span className="block text-xs text-ink-soft">
            {e.takeHomeEstimated
              ? `Estimate: EPF ${rm(e.mainBreakdown.epfRM)}, SOCSO+EIS ${rm(e.mainBreakdown.socsoRM)}, PCB about ${rm(e.mainBreakdown.pcbRM)}`
              : "Your take-home as typed"}
            {e.jointNetRM > 0 ? `; joint applicant about ${rm(e.jointNetRM)}` : ""}
            {e.otherCountedRM > 0 ? `; other income at ${Math.round(OTHER_INCOME_COUNTED * 100)}%` : ""}
          </span>
        </dt>
        <dd className="text-right tabular-nums">{rm(e.netRM)}</dd>
        <dt>Loans you already pay</dt>
        <dd className="text-right tabular-nums">{rm(e.commitmentsRM)}</dd>
        <dt>Loan tenure</dt>
        <dd className="text-right tabular-nums">{e.tenureYears} years</dd>
      </dl>
      <p className="text-xs font-medium text-ink-soft">{HONEST}</p>
    </PixPanel>
  );
}

/** DSR bar in 5% blocks with 60% and 70% marks. */
function DsrGauge({ e }: { e: Eligibility }) {
  const now = Math.min(e.dsrNow, 1);
  const room = Math.max(e.dsr - now, 0);
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-pixel text-base leading-none">Debt service ratio</h3>
        <p className="text-sm tabular-nums">
          {pct(e.dsrNow)} used now
        </p>
      </div>
      <div className="relative pb-6">
        <div
          role="meter"
          aria-label="Debt service ratio before the home loan"
          aria-valuenow={Math.round(e.dsrNow * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${pct(e.dsrNow)} of take-home already goes to loans. Most banks allow ${pct(e.dsr)}, some up to ${pct(HIGH_DSR)}.`}
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
          <span aria-hidden className="size-3 shrink-0 bg-raya" /> Loans now {pct(now)}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 shrink-0 bg-pandan" /> Room for a home {pct(room)}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 shrink-0 bg-kaya" /> Some banks, to {pct(HIGH_DSR)}
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
  const rows = bankEstimates(input, target.priceRM);
  return (
    <PixPanel className="grid gap-3 p-5">
      <div className="grid gap-2">
        <h2 className="font-pixel text-lg leading-tight">What five banks might say</h2>
        <label htmlFor="bank-target" className="text-sm">
          For this home
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
            Sample estimate per bank for {target.name}: assumed DSR ceiling, maximum loan and likely answer
          </caption>
          <thead>
            <tr className="text-left text-xs text-ink-soft">
              <th scope="col" className="py-1.5 pr-2 font-normal">Bank</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-normal">DSR cap</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-normal">Rate</th>
              <th scope="col" className="py-1.5 pr-2 text-right font-normal">Max loan</th>
              <th scope="col" className="py-1.5 text-right font-normal">This home</th>
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
                  <PixTag tone={verdictTone[r.verdict].tone}>{verdictTone[r.verdict].label}</PixTag>
                  <span className="block pt-0.5 text-xs text-ink-soft tabular-nums">
                    {Number.isFinite(r.dsrWithHome) ? `DSR ${pct(r.dsrWithHome)}` : "Tenure too short"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-soft">
        Sample assumptions, not the banks&apos; published criteria. Caps change by take-home band (under{" "}
        {rm(INCOME_BANDS[0])}, up to {rm(INCOME_BANDS[1])}, above). Likely yes leaves 5 points of room under the cap;
        maybe is within 5 points. {HONEST}
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
          Homes in your range
        </h2>
        <p className="text-sm text-ink tabular-nums">
          {counts.in} in range, {counts.stretch} stretch, {counts.out} out of range
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
                      {statusTag[fit.status].label}
                    </PixTag>
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-xs text-ink-soft">{townshipById[u.townshipId]?.name}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-ink-soft">Price</dt>
                    <dd className="text-sm font-medium tabular-nums">{rm(u.priceRM)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">Monthly</dt>
                    <dd className="text-sm font-medium tabular-nums">{rm(fit.instalmentRM)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">Left each month</dt>
                    <dd className={cn("text-sm font-medium tabular-nums", fit.leftRM < 1_500 && "text-raya-deep")}>
                      {rm(fit.leftRM)}
                    </dd>
                  </div>
                </dl>
                {fit.status !== "in" && e.maxPriceRM > 0 ? (
                  <p className="text-xs text-ink-soft tabular-nums">{rm(u.priceRM - e.maxPriceRM)} over your limit</p>
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
                    {isLiked ? "Liked" : "Like"}
                  </PixButton>
                  <PixButton asChild size="sm" tone="lilac" className="flex-1">
                    <Link
                      href="/battle"
                      onClick={() =>
                        homelander.setCompare([...compare.filter((x) => x !== u.id), u.id].slice(-3))
                      }
                    >
                      <Sprite art="bars" scale={2} />
                      {inBattle ? "In battle" : "Battle"}
                    </Link>
                  </PixButton>
                </div>
              </PixPanel>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-soft">
        Monthly is a {Math.round(MARGIN * 100)}% loan over {e.tenureYears} years at {(e.rate * 100).toFixed(1)}%
        (sample rate). Left each month is take-home minus every loan, before food, bills and nasi lemak. Stretch means
        up to 10% over your limit. Prices are sample data. {HONEST}
      </p>
    </section>
  );
}
