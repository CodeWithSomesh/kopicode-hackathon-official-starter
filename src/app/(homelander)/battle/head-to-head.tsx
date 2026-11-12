"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { PixMeter, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import {
  bestIndices,
  leadOverNext,
  STATS,
  type Weights,
} from "@/lib/homelander/analysis";
import type { BattleContext } from "@/lib/homelander/battle-context";
import type { Fighter } from "@/lib/homelander/battle-verdict";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import { caret, gauge, kRM, money, useStepIn } from "./bits";
import { FighterHead } from "./fighter-head";
import { buildSections, type Row, type Section, type Tone } from "./rows";

const toneText: Record<Tone, string> = {
  bad: "text-raya-deep",
  warn: "text-kaya-deep",
  good: "text-pandan-deep",
  muted: "text-ink-soft",
};

const stickyCol =
  "sticky left-0 z-10 bg-white shadow-[1.5px_0_0_0_var(--color-ink)]";

/**
 * The big table. Fighters are columns (5 fit at 1280px), rows are grouped into collapsible
 * sections. On phones the table scrolls sideways, snapping fighter by fighter, with the
 * factor column pinned.
 */
export function HeadToHead({
  fighters,
  ctx,
  winnerId,
  weights,
  lineup,
  onSwap,
  onRemove,
}: {
  fighters: Fighter[];
  ctx: BattleContext;
  winnerId: string;
  weights: Weights;
  lineup: string[];
  onSwap: (slot: number, id: string) => void;
  onRemove: (slot: number) => void;
}) {
  const t = useT();
  const sections = buildSections(fighters, ctx, t);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setClosed((c) => ({ ...c, [id]: !c[id] }));
  const n = fighters.length;
  const winnerCol = (f: Fighter) => f.unit.id === winnerId && n > 1;

  return (
    <section
      aria-labelledby="h2h-title"
      className="grid grid-cols-[minmax(0,1fr)] gap-3"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2
          id="h2h-title"
          className="font-pixel text-2xl leading-none lg:text-3xl"
        >
          {t("Head to head")}
        </h2>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-soft">
          <li className="flex items-center gap-1.5">
            <Sprite art="star" scale={2} className="text-kaya-deep" /> {t("Best in the row")}
          </li>
          <li className="flex items-center gap-1.5">
            <PixTag tone="lilac">You</PixTag> {t("Your way to work")}
          </li>
          <li className="flex items-center gap-1.5">
            <EstChip /> {t("Estimate, not a quote")}
          </li>
        </ul>
      </div>
      <p className="text-sm text-ink-soft lg:hidden">
        {t("Swipe the table sideways to see every home. The left column stays put.")}
      </p>

      <PixPanel className="overflow-hidden p-0">
        <div
          className="snap-x snap-mandatory scroll-pl-[8.5rem] overflow-x-auto overscroll-x-contain lg:snap-none lg:scroll-pl-0"
          tabIndex={0}
          role="region"
          aria-label={t("Head-to-head table. Scrolls sideways on small screens.")}
        >
          <table
            className="w-full min-w-[var(--tw)] table-fixed border-separate border-spacing-0 text-left text-sm tabular-nums lg:min-w-[var(--tw-lg)]"
            style={
              {
                "--tw": `calc(8.5rem + ${n} * 11rem)`,
                "--tw-lg": `calc(12rem + ${n} * 10rem)`,
              } as CSSProperties
            }
          >
            <caption className="sr-only">
              {t("Every factor for each home. A star marks the best cell in a row. Figures are estimates.")}
            </caption>
            <colgroup>
              <col className="w-[8.5rem] lg:w-[12rem]" />
              {fighters.map((f) => (
                <col key={f.unit.id} />
              ))}
            </colgroup>

            <thead>
              <tr>
                <th
                  scope="col"
                  className={cn(stickyCol, "z-20 px-3 pt-3 pb-3 align-bottom")}
                >
                  <span className="font-pixel-label text-[11px] uppercase">
                    {t("{n} of 5 homes", { n })}
                  </span>
                </th>
                {fighters.map((f, i) => (
                  <th
                    key={f.unit.id}
                    scope="col"
                    className={cn(
                      "snap-start px-2.5 pt-3 pb-3 align-top lg:px-3",
                      winnerCol(f) && "bg-kaya/15",
                    )}
                  >
                    <FighterHead
                      f={f}
                      slot={i}
                      isWinner={winnerCol(f)}
                      lineup={lineup}
                      onSwap={(id) => onSwap(i, id)}
                      onRemove={n > 1 ? () => onRemove(i) : undefined}
                    />
                  </th>
                ))}
              </tr>
              <HeadlineRow
                fighters={fighters}
                winnerCol={winnerCol}
                ctx={ctx}
              />
              <OverallRow
                key={fighters.map((f) => `${f.unit.id}:${f.overall}`).join()}
                fighters={fighters}
                winnerCol={winnerCol}
              />
            </thead>

            {sections.map((s) => (
              <SectionBody
                key={s.id}
                section={s}
                fighters={fighters}
                open={!closed[s.id]}
                onToggle={() => toggle(s.id)}
                winnerCol={winnerCol}
              />
            ))}
            <SectionBody
              section={{
                id: "scores",
                title: t("Scores out of 100"),
                art: gauge,
                blurb: t("What the overall is made of, on the weights you set"),
                rows: STATS.map((st): Row => ({
                  id: `stat-${st.key}`,
                  label: `${t(st.label)} (×${weights[st.key]})`,
                  hint: t(st.hint),
                  cell: (f) => ({
                    main: (
                      <span className="grid gap-1">
                        <span className="font-pixel text-base leading-none">
                          {f.stats[st.key]}
                        </span>
                        <PixMeter
                          value={f.stats[st.key]}
                          tone="pandan"
                          label={t("{label} {n} of 100", { label: t(st.label), n: f.stats[st.key] })}
                          className="max-w-[8rem]"
                        />
                      </span>
                    ),
                  }),
                  value: (f) => f.stats[st.key],
                  better: "high",
                })),
              }}
              fighters={fighters}
              open={!closed.scores}
              onToggle={() => toggle("scores")}
              winnerCol={winnerCol}
            />
          </table>
        </div>
      </PixPanel>
    </section>
  );
}

function EstChip() {
  return (
    <span className="inline-flex items-center rounded-full border border-ink/50 px-1.5 font-pixel-label text-[9px] leading-[1.5] text-ink-soft uppercase">
      est.
    </span>
  );
}

/* ---------------------------------------------------------------- headline strip */

function HeadlineRow({
  fighters,
  winnerCol,
  ctx,
}: {
  fighters: Fighter[];
  winnerCol: (f: Fighter) => boolean;
  ctx: BattleContext;
}) {
  const t = useT();
  const items: {
    label: string;
    value: (f: Fighter) => number | null;
    show: (f: Fighter) => ReactNode;
    sub?: (f: Fighter) => ReactNode;
  }[] = [
    {
      label: t("All-in per month"),
      value: (f) => f.totalMonthlyRM,
      show: (f) => money(f.totalMonthlyRM),
      sub: (f) =>
        f.leftRM < 0 ? (
          <span className="text-raya-deep">
            {t("{amount} short a month", { amount: money(-f.leftRM) })}
          </span>
        ) : (
          t("{amount} left", { amount: money(f.leftRM) })
        ),
    },
    {
      label: t("Commuting a year"),
      value: (f) => (f.you.compared ? f.you.hoursPerYear : null),
      show: (f) => (f.you.compared ? `${f.you.hoursPerYear} h` : "n/a"),
      sub: (f) =>
        f.you.compared
          ? t("{n} min each way", { n: f.you.oneWayMin })
          : t("Not a daily commute"),
    },
    {
      label: t("Cash upfront"),
      value: (f) => f.upfrontRM,
      show: (f) => kRM(f.upfrontRM),
      sub: (f) =>
        f.savingsGapRM === null ? (
          t("Savings unknown")
        ) : f.savingsGapRM < 0 ? (
          <span className="text-raya-deep">{t("{amount} short", { amount: kRM(-f.savingsGapRM) })}</span>
        ) : (
          t("{amount} to spare", { amount: kRM(f.savingsGapRM) })
        ),
    },
  ];
  const best = items.map((it) => bestIndices(fighters.map(it.value), "low"));
  return (
    <tr>
      <th
        scope="row"
        className={cn(
          stickyCol,
          "border-t-[1.5px] border-ink bg-cloud px-3 py-3 align-top",
        )}
      >
        <span className="block font-pixel text-base leading-tight">
          {t("At a glance")}
        </span>
        <span className="mt-1 block text-xs font-normal text-ink-soft">
          {t("{n} days to {work}", { n: ctx.officeDays, work: ctx.work.name })}
          {ctx.money.source === "sample" ? t(", sample payslip") : ""}
        </span>
      </th>
      {fighters.map((f, i) => (
        <td
          key={f.unit.id}
          className={cn(
            "border-t-[1.5px] border-ink bg-cloud px-2.5 py-3 align-top lg:px-3",
            winnerCol(f) && "bg-kaya/25",
          )}
        >
          <dl className="grid gap-2.5">
            {items.map((it, j) => (
              <div key={it.label} className="grid gap-0.5">
                <dt className="font-pixel-label text-[10px] text-ink-soft uppercase">
                  {it.label}
                </dt>
                <dd className="flex items-center gap-1.5 font-pixel text-lg leading-none">
                  {it.show(f)}
                  {best[j]!.has(i) ? (
                    <Sprite
                      art="star"
                      scale={2}
                      className="shrink-0 text-kaya-deep"
                      label={t("Best")}
                    />
                  ) : null}
                </dd>
                {it.sub ? (
                  <dd className="text-[11px] leading-tight text-ink-soft">
                    {it.sub(f)}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        </td>
      ))}
    </tr>
  );
}

/** Overall score, counting up block by block when the result changes. */
function OverallRow({
  fighters,
  winnerCol,
}: {
  fighters: Fighter[];
  winnerCol: (f: Fighter) => boolean;
}) {
  const t = useT();
  const p = useStepIn();
  const best = bestIndices(
    fighters.map((f) => f.overall),
    "high",
  );
  return (
    <tr>
      <th
        scope="row"
        className={cn(
          stickyCol,
          "border-b-[1.5px] border-ink px-3 py-3 align-middle",
        )}
      >
        <span className="block font-pixel text-base leading-tight">
          {t("Overall")}
        </span>
        <span className="block text-xs font-normal text-ink-soft">
          {t("Weighted by your priorities")}
        </span>
      </th>
      {fighters.map((f, i) => (
        <td
          key={f.unit.id}
          className={cn(
            "border-b-[1.5px] border-ink px-2.5 py-3 align-middle lg:px-3",
            winnerCol(f) && "bg-kaya/15",
          )}
        >
          <div className="grid gap-1.5">
            <span className="flex items-center gap-1.5 font-pixel text-3xl leading-none">
              {Math.round(f.overall * p)}
              {best.has(i) ? (
                <Sprite
                  art="star"
                  scale={2}
                  className="text-kaya-deep"
                  label={t("Best")}
                />
              ) : null}
            </span>
            <PixMeter
              value={f.overall * p}
              tone={winnerCol(f) ? "kaya" : "sky"}
              label={t("Overall {n} of 100", { n: f.overall })}
              className="max-w-[9rem]"
            />
            {f.penalty ? (
              <span className="text-[11px] leading-tight font-semibold text-raya-deep">
                {t("−{n} for your deal-breakers / must-haves", { n: f.penalty })}
              </span>
            ) : null}
          </div>
        </td>
      ))}
    </tr>
  );
}

/* ---------------------------------------------------------------- sections */

function SectionBody({
  section,
  fighters,
  open,
  onToggle,
  winnerCol,
}: {
  section: Section;
  fighters: Fighter[];
  open: boolean;
  onToggle: () => void;
  winnerCol: (f: Fighter) => boolean;
}) {
  const t = useT();
  const bodyId = `sec-${section.id}`;
  return (
    <tbody id={bodyId}>
      <tr>
        <th
          colSpan={fighters.length + 1}
          scope="colgroup"
          className="border-b border-ink/20 bg-cloud p-0 text-left"
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={bodyId}
            className="sticky left-0 flex w-max max-w-[100vw] items-center gap-2.5 px-3 py-2.5 text-left"
          >
            <Sprite
              art={caret}
              scale={2}
              className={cn(
                "shrink-0 text-ink transition-transform motion-reduce:transition-none",
                !open && "-rotate-90",
              )}
            />
            <Sprite
              art={section.art}
              scale={2}
              className="shrink-0 text-pandan-deep"
            />
            <span className="font-pixel text-lg leading-none">
              {section.title}
            </span>
            {section.blurb ? (
              <span className="hidden text-xs font-normal text-ink-soft sm:inline">
                {section.blurb}
              </span>
            ) : null}
            {!open ? (
              <span className="text-xs font-normal text-ink-soft">
                {t("({n} rows hidden)", { n: section.rows.length })}
              </span>
            ) : null}
          </button>
        </th>
      </tr>
      {open
        ? section.rows.map((r) => (
            <RowView
              key={r.id}
              row={r}
              fighters={fighters}
              winnerCol={winnerCol}
            />
          ))
        : null}
    </tbody>
  );
}

function RowView({
  row,
  fighters,
  winnerCol,
}: {
  row: Row;
  fighters: Fighter[];
  winnerCol: (f: Fighter) => boolean;
}) {
  const t = useT();
  const values = row.value ? fighters.map(row.value) : null;
  const best =
    values && row.better ? bestIndices(values, row.better) : new Set<number>();
  const gap =
    values && row.better && best.size === 1
      ? leadOverNext(values, row.better)
      : null;
  return (
    <tr className={cn("group", row.strong && "bg-kaya/10")}>
      <th
        scope="row"
        className={cn(
          stickyCol,
          "border-b border-ink/15 px-3 py-2.5 align-top font-semibold",
          row.strong && "bg-[color-mix(in_oklab,var(--color-kaya)_10%,white)]",
        )}
      >
        <span className="flex flex-wrap items-center gap-1.5 leading-tight">
          {row.label}
          {row.estimated ? <EstChip /> : null}
          {row.mine ? <PixTag tone="lilac">You</PixTag> : null}
        </span>
        {row.hint ? (
          <span className="mt-0.5 block text-[11px] leading-snug font-normal text-ink-soft">
            {row.hint}
          </span>
        ) : null}
      </th>
      {fighters.map((f, i) => {
        const c = row.cell(f);
        const isBest = best.has(i);
        return (
          <td
            key={f.unit.id}
            className={cn(
              "border-b border-ink/15 px-2.5 py-2.5 align-top lg:px-3",
              winnerCol(f) && "bg-kaya/10",
              isBest && "bg-pandan/15",
            )}
          >
            <span
              className={cn(
                "flex items-start gap-1.5 font-semibold",
                row.strong && "font-pixel text-base",
                c.tone && toneText[c.tone],
              )}
            >
              <span className="min-w-0">{c.main}</span>
              {isBest ? (
                <Sprite
                  art="star"
                  scale={2}
                  className="mt-0.5 shrink-0 text-kaya-deep"
                  label={t("Best")}
                />
              ) : null}
            </span>
            {c.sub ? (
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">
                {c.sub}
              </span>
            ) : null}
            {isBest && gap !== null && row.lead ? (
              <span className="mt-0.5 block text-[11px] leading-snug font-semibold text-pandan-deep">
                {row.lead(gap)}
              </span>
            ) : null}
          </td>
        );
      })}
    </tr>
  );
}
