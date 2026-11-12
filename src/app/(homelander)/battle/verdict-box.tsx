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
import { useT } from "@/lib/homelander/i18n/client";
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
  const t = useT();
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
              {allSoldOut ? t("Top pick") : t("Winner")}
            </PixTag>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Mini label={t("Per month")} value={kRM(winner.totalMonthlyRM)} />
            <Mini
              label={t("Commute")}
              value={
                winner.you.compared
                  ? t("{n}h/yr", { n: winner.you.hoursPerYear })
                  : winner.you.missing
                    ? "?"
                    : t("n/a")
              }
            />
            <Mini label={t("Upfront")} value={kRM(winner.upfrontRM)} />
          </dl>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <div className="grid gap-1.5">
            <h2
              id="verdict-title"
              className="font-pixel text-2xl leading-tight lg:text-3xl"
            >
              {winner.unit.name}{" "}
              {allSoldOut ? t("scores best, but it's sold out") : t("wins")}
            </h2>
            <p className="text-sm text-ink-soft">
              {winner.township.name}, {winner.township.area}.{" "}
              {runnerUp ? (
                <span className="tabular-nums">
                  {closeCall
                    ? t("Close fight: {a} vs {b} over {name}. Nudge the priorities and it could flip.", { a: winner.overall, b: runnerUp.overall, name: runnerUp.unit.name })
                    : t("{a} vs {b} over {name}, on your priorities.", { a: winner.overall, b: runnerUp.overall, name: runnerUp.unit.name })}
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
                <span>{t(r)}</span>
              </li>
            ))}
          </ul>

          {rivals.length ? (
            <div className="grid gap-1.5">
              <h3 className="font-pixel text-base leading-none">
                {t("Against each rival")}
              </h3>
              <ul className="grid gap-1 text-sm tabular-nums">
                {rivals.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-dotted border-ink/25 pb-1"
                  >
                    <span className="min-w-0 font-semibold">{t("vs {name}", { name: r.name })}</span>
                    <Delta
                      n={r.monthlyRM}
                      fmt={(v) => t("{amt}/mo", { amt: money(v) })}
                      what="monthly cost"
                    />
                    {r.hoursPerYear !== null ? (
                      <Delta
                        n={r.hoursPerYear}
                        fmt={(v) => t("{n} h/yr", { n: v })}
                        what="commute"
                      />
                    ) : null}
                    <Delta
                      n={r.upfrontRM}
                      fmt={(v) => t("{amt} upfront", { amt: kRM(v) })}
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
                {t("Check this first")}
              </h3>
              <ul className="grid gap-1.5 text-sm">
                {caveats.map((c) => (
                  <li key={c} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-raya"
                    />
                    <span>{t(c)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <PixButton asChild tone="kaya">
              <Link href="/bank">
                <Sprite art="bank" scale={2} />
                {t("Check the bank")}
              </Link>
            </PixButton>
            <PixButton asChild>
              <Link href={`/homes/${winner.unit.id}/feng-shui`}>
                <Sprite art="sparkle" scale={2} />
                {t("Try Feng Shui")}
              </Link>
            </PixButton>
            <PixButton asChild>
              <Link href="/onboarding">
                <Sprite art="mochi" scale={2} />
                {t("Ask Mochi")}
              </Link>
            </PixButton>
          </div>
          <p className="text-xs text-ink-soft">
            {t("Estimates from {src}, modelled commute times and estimated tolls. Not a loan offer or a price quote.", {
              src:
                ctx.money.source === "missing"
                  ? t("what you told Mochi (salary not known yet)")
                  : ctx.money.source === "bank"
                    ? t("your bank check")
                    : t("what you told Mochi"),
            })}
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
  const t = useT();
  if (Math.abs(n) < 1)
    return <span className="text-ink-soft">{t("same")} {t(what)}</span>;
  return (
    <span className={cn(n > 0 ? "text-pandan-deep" : "text-raya-deep")}>
      {n > 0 ? `${t("saves")} ` : `${t("costs")} `}
      {fmt(Math.abs(n))}
      {n > 0 ? "" : ` ${t("more")}`}
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
  const t = useT();
  const order = [
    battle.winner,
    ...battle.fighters.filter((f) => f.unit.id !== battle.winner.unit.id),
  ];
  return (
    <div className="grid gap-1.5">
      <h3 className="font-pixel text-base leading-none">
        {t("Your must-haves and deal-breakers")}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-ink/30">
              <th scope="col" className="py-1.5 pr-2 font-semibold">
                {t("You said")}
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
                    {c.kind === "must" ? t("Must") : t("Never")}
                  </span>{" "}
                  {t(c.text)}
                </th>
                {order.map((f) => {
                  const r = c.results[f.unit.id]!;
                  const ic = okIcon[r.ok];
                  return (
                    <td
                      key={f.unit.id}
                      className="px-1.5 py-1.5 align-top"
                      title={t(r.why)}
                    >
                      <span className="flex items-start gap-1">
                        <Sprite
                          art={ic.art}
                          scale={1.5}
                          className={cn("mt-0.5 shrink-0", ic.cls)}
                          label={t(ic.label)}
                        />
                        <span className="text-ink-soft">{t(r.why)}</span>
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
