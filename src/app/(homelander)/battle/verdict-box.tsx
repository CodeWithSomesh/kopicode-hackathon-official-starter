"use client";

import Link from "next/link";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import {
  Sprite,
  type SpriteArt,
  type SpriteName,
} from "@/components/homelander/sprite";
import { UnitPhoto } from "@/components/homelander/unit-photo";
import type { BattleContext } from "@/lib/homelander/battle-context";
import type { Battle, CheckOk } from "@/lib/homelander/battle-verdict";
import { cn } from "@/lib/utils";
import { crown, dash, kRM, money, tick } from "./bits";

/** HomeLander's call: who wins, why (in numbers), what to check first, and the next step. */
export function VerdictBox({
  battle,
  ctx,
}: {
  battle: Battle;
  ctx: BattleContext;
}) {
  const { winner, runnerUp, reasons, caveats, closeCall, rivals, checks } =
    battle;
  const allSoldOut = winner.soldOut;
  return (
    <section aria-labelledby="verdict-title" aria-live="polite">
      <PixPanel className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6">
        {/* Winner card */}
        <div className="grid content-start gap-3">
          <div className="relative">
            <UnitPhoto
              photo={winner.unit.photo}
              alt={winner.unit.photoAlt}
              width={448}
              height={280}
              className="pix-img aspect-[16/10] w-full rounded-lg border-2 border-ink object-cover"
            />
            <PixTag tone="kaya" className="absolute top-2 left-2">
              <Sprite art={crown} scale={1.5} className="text-ink" />
              {allSoldOut ? "Top pick" : "Winner"}
            </PixTag>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Mini label="Per month" value={kRM(winner.totalMonthlyRM)} />
            <Mini
              label="Commute"
              value={
                winner.you.compared
                  ? `${winner.you.hoursPerYear}h/yr`
                  : winner.you.missing
                    ? "?"
                    : "n/a"
              }
            />
            <Mini label="Upfront" value={kRM(winner.upfrontRM)} />
          </dl>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <div className="grid gap-1.5">
            <h2
              id="verdict-title"
              className="font-pixel text-2xl leading-tight lg:text-3xl"
            >
              {winner.unit.name}{" "}
              {allSoldOut ? "scores best, but it's sold out" : "wins"}
            </h2>
            <p className="text-sm text-ink-soft">
              {winner.township.name}, {winner.township.area}.{" "}
              {runnerUp ? (
                <span className="tabular-nums">
                  {closeCall
                    ? `Close fight: ${winner.overall} vs ${runnerUp.overall} over ${runnerUp.unit.name}. Nudge the priorities and it could flip.`
                    : `${winner.overall} vs ${runnerUp.overall} over ${runnerUp.unit.name}, on your priorities.`}
                </span>
              ) : null}
            </p>
          </div>

          <ul className="grid gap-2">
            {reasons.map((r) => (
              <li key={r} className="flex items-start gap-2.5">
                <Sprite
                  art="star"
                  scale={2}
                  className="mt-1 shrink-0 text-kaya-deep"
                />
                <span>{r}</span>
              </li>
            ))}
          </ul>

          {rivals.length ? (
            <div className="grid gap-1.5">
              <h3 className="font-pixel text-base leading-none">
                Against each rival
              </h3>
              <ul className="grid gap-1 text-sm tabular-nums">
                {rivals.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-dotted border-ink/25 pb-1"
                  >
                    <span className="min-w-0 font-semibold">vs {r.name}</span>
                    <Delta
                      n={r.monthlyRM}
                      fmt={(v) => `${money(v)}/mo`}
                      what="monthly cost"
                    />
                    {r.hoursPerYear !== null ? (
                      <Delta
                        n={r.hoursPerYear}
                        fmt={(v) => `${v} h/yr`}
                        what="commute"
                      />
                    ) : null}
                    <Delta
                      n={r.upfrontRM}
                      fmt={(v) => `${kRM(v)} upfront`}
                      what="upfront"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {checks.length ? <ChecksTable battle={battle} /> : null}

          {caveats.length ? (
            <div className="grid gap-2 border-t-[1.5px] border-dotted border-ink/30 pt-3">
              <h3 className="font-pixel text-base leading-none">
                Check this first
              </h3>
              <ul className="grid gap-1.5 text-sm">
                {caveats.map((c) => (
                  <li key={c} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-raya"
                    />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <PixButton asChild tone="kaya">
              <Link href="/bank">
                <Sprite art="bank" scale={2} />
                Check the bank
              </Link>
            </PixButton>
            <PixButton asChild>
              <Link href={`/homes/${winner.unit.id}/feng-shui`}>
                <Sprite art="sparkle" scale={2} />
                Try Feng Shui
              </Link>
            </PixButton>
            <PixButton asChild>
              <Link href="/onboarding">
                <Sprite art="mochi" scale={2} />
                Ask Mochi
              </Link>
            </PixButton>
          </div>
          <p className="text-xs text-ink-soft">
            Estimates from{" "}
            {ctx.money.source === "missing"
              ? "what you told Mochi (salary not known yet)"
              : ctx.money.source === "bank"
                ? "your bank check"
                : "what you told Mochi"}
            , modelled commute times and estimated tolls. Not a loan offer or a
            price quote.
          </p>
        </div>
      </PixPanel>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg bg-cloud px-1 py-2">
      <dt className="font-pixel-label text-[9px] text-ink-soft uppercase">
        {label}
      </dt>
      <dd className="font-pixel text-sm leading-none tabular-nums">{value}</dd>
    </div>
  );
}

/** Positive n: the rival costs more (good for the winner). */
function Delta({
  n,
  fmt,
  what,
}: {
  n: number;
  fmt: (v: number) => string;
  what: string;
}) {
  if (Math.abs(n) < 1)
    return <span className="text-ink-soft">same {what}</span>;
  return (
    <span className={cn(n > 0 ? "text-pandan-deep" : "text-raya-deep")}>
      {n > 0 ? "saves " : "costs "}
      {fmt(Math.abs(n))}
      {n > 0 ? "" : " more"}
    </span>
  );
}

const okIcon: Record<
  CheckOk,
  { art: SpriteName | SpriteArt; cls: string; label: string }
> = {
  yes: { art: tick, cls: "text-pandan-deep", label: "OK" },
  no: { art: "cross", cls: "text-raya", label: "Fails" },
  unknown: { art: dash, cls: "text-ink-soft", label: "Can't tell" },
};

function ChecksTable({ battle }: { battle: Battle }) {
  const order = [
    battle.winner,
    ...battle.fighters.filter((f) => f.unit.id !== battle.winner.unit.id),
  ];
  return (
    <div className="grid gap-1.5">
      <h3 className="font-pixel text-base leading-none">
        Your must-haves and deal-breakers
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-ink/30">
              <th scope="col" className="py-1.5 pr-2 font-semibold">
                You said
              </th>
              {order.map((f) => (
                <th
                  key={f.unit.id}
                  scope="col"
                  className="max-w-[7rem] truncate px-1.5 py-1.5 font-semibold"
                  title={f.unit.name}
                >
                  {f.unit.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {battle.checks.map((c) => (
              <tr
                key={`${c.kind}:${c.text}`}
                className="border-b border-dotted border-ink/20 last:border-0"
              >
                <th scope="row" className="py-1.5 pr-2 align-top font-normal">
                  <span className="font-pixel-label text-[9px] text-ink-soft uppercase">
                    {c.kind === "must" ? "Must" : "Never"}
                  </span>{" "}
                  {c.text}
                </th>
                {order.map((f) => {
                  const r = c.results[f.unit.id]!;
                  const ic = okIcon[r.ok];
                  return (
                    <td
                      key={f.unit.id}
                      className="px-1.5 py-1.5 align-top"
                      title={r.why}
                    >
                      <span className="flex items-start gap-1">
                        <Sprite
                          art={ic.art}
                          scale={1.5}
                          className={cn("mt-0.5 shrink-0", ic.cls)}
                          label={ic.label}
                        />
                        <span className="text-ink-soft">{r.why}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
