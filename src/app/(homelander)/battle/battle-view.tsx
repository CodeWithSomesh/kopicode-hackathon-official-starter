"use client";

import Link from "next/link";
import { useState } from "react";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import {
  analyseHome,
  PRESETS,
  uncleWeights,
  type StatKey,
  type Weights,
} from "@/lib/homelander/analysis";
import {
  battleContext,
  budgetForMatch,
  type BattleContext,
  type CommuteMode,
} from "@/lib/homelander/battle-context";
import {
  BATTLE_MAX,
  runBattle,
  startingLineup,
  type LineupSource,
} from "@/lib/homelander/battle-verdict";
import { anchorOptions, unitById, type Unit } from "@/lib/homelander/data";
import { recommend } from "@/lib/homelander/recommend";
import { homelander, useHomeLander } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";
import { kRM, swords, UnitSelect } from "./bits";
import { HeadToHead } from "./head-to-head";
import { Priorities, type WeightMode } from "./priorities";
import { VerdictBox } from "./verdict-box";

const isUnit = (id: string) => id in unitById;

const sourceCopy: Record<
  LineupSource,
  { tag: string; tone: "kaya" | "pandan" | "lilac"; text: string }
> = {
  sample: {
    tag: "Sample lineup",
    tone: "kaya",
    text: "You haven't liked two homes yet, so here are top matches from different projects.",
  },
  mixed: {
    tag: "1 like + samples",
    tone: "kaya",
    text: "Your one like, against top matches from other projects.",
  },
  liked: {
    tag: "From your likes",
    tone: "pandan",
    text: "Your liked homes, best match first.",
  },
  picks: {
    tag: "Your lineup",
    tone: "lilac",
    text: "The homes you sent to Battle.",
  },
};

export function BattleView() {
  const s = useHomeLander();

  const [workId, setWorkId] = useState<string | null>(null);
  const [officeDays, setOfficeDays] = useState<number | null>(null);
  const [mode, setMode] = useState<CommuteMode | null>(null);
  const [weightMode, setWeightMode] = useState<WeightMode>("uncle");
  const [custom, setCustom] = useState<Weights | null>(null);

  const ctx = battleContext(s, { workId, officeDays, mode });
  const matchBudget = budgetForMatch(ctx, s.budget);
  const ranked = recommend(s.profile, matchBudget, ctx.work);
  const matchById = new Map(ranked.map((p) => [p.unit.id, p.score]));

  const { ids, source } = startingLineup(
    s,
    isUnit,
    ranked.map((p) => p.unit),
  );
  const list = ids.map((id) => unitById[id]).filter(Boolean) as Unit[];

  const uncle = uncleWeights(ctx, list[0] ? analyseHome(list[0], ctx) : null);
  const weights: Weights =
    weightMode === "custom" && custom
      ? custom
      : weightMode === "uncle" || weightMode === "custom"
        ? uncle.weights
        : PRESETS[weightMode].weights;

  const result = runBattle(list, ctx, weights, (u) => matchById.get(u.id) ?? 0);

  const save = (next: string[]) =>
    homelander.setCompare(next.slice(0, BATTLE_MAX));
  const swap = (slot: number, id: string) => {
    const next = [...ids];
    const other = next.indexOf(id);
    if (other >= 0) next[other] = next[slot]!;
    next[slot] = id;
    save(next);
  };
  const remove = (slot: number) => {
    if (ids.length > 1) save(ids.filter((_, i) => i !== slot));
  };
  const add = (id: string) => {
    if (ids.length < BATTLE_MAX && !ids.includes(id)) save([...ids, id]);
  };
  const setWeight = (k: StatKey, v: number) => {
    setCustom({ ...weights, [k]: v });
    setWeightMode("custom");
  };

  const likedTop = s.liked
    .filter(isUnit)
    .sort((a, b) => (matchById.get(b) ?? 0) - (matchById.get(a) ?? 0))
    .slice(0, BATTLE_MAX);
  const canUseLikes =
    source === "picks" &&
    likedTop.length >= 2 &&
    likedTop.join() !== ids.join();

  const src = sourceCopy[source];
  const winnerId = result?.winner.unit.id ?? "";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:gap-8">
      {/* Title */}
      <header className="grid gap-2">
        <h1 className="flex items-center gap-3 font-pixel text-3xl leading-none lg:text-5xl">
          <Sprite
            art={swords}
            scale={4}
            className="shrink-0 text-pandan-deep"
          />
          Battle of the homes
        </h1>
        <p className="max-w-3xl text-ink-soft">
          Up to {BATTLE_MAX} Gamuda Land homes, side by side on what you&apos;d
          pay every month, how long you&apos;d spend getting to work, room for
          the family and the home itself. Every figure is an estimate you can
          check row by row.
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <PixTag tone={src.tone}>{src.tag}</PixTag>
          <span className="text-ink-soft">{src.text}</span>
          {source === "sample" || source === "mixed" ? (
            <Link
              href="/swipe"
              className="font-semibold underline decoration-2 underline-offset-4"
            >
              Swipe to pick your own
            </Link>
          ) : null}
          {canUseLikes ? (
            <button
              type="button"
              onClick={() => save(likedTop)}
              className="font-semibold underline decoration-2 underline-offset-4"
            >
              Use my top {likedTop.length} likes
            </button>
          ) : null}
        </p>
      </header>

      {!ctx.hasProfile ? <NoProfile ctx={ctx} /> : null}

      <SetupBar
        ctx={ctx}
        onWork={setWorkId}
        onOfficeDays={setOfficeDays}
        onMode={setMode}
        ids={ids}
        onAdd={add}
      />

      {result && list.length >= 2 ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
          <VerdictBox key={winnerId} battle={result} ctx={ctx} />
          <Priorities
            mode={weightMode}
            weights={weights}
            uncleWhy={uncle.why}
            hasProfile={ctx.hasProfile}
            onPreset={(p) => setWeightMode(p)}
            onWeight={setWeight}
          />
        </div>
      ) : (
        <NeedTwo ids={ids} onAdd={add} />
      )}

      {result ? (
        <HeadToHead
          fighters={result.fighters}
          ctx={ctx}
          winnerId={list.length >= 2 ? winnerId : ""}
          weights={weights}
          lineup={ids}
          onSwap={swap}
          onRemove={remove}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function NoProfile({ ctx }: { ctx: BattleContext }) {
  return (
    <PixPanel
      tone="kaya"
      flat
      className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-5"
    >
      <Sprite art="uncle" scale={4} className="hidden text-ink sm:block" />
      <div className="grid gap-1">
        <p className="font-pixel text-lg leading-tight">
          You haven&apos;t sat with Uncle yet
        </p>
        <p className="text-sm">
          So this battle uses stand-ins: {ctx.defaults.join(", ")}. Ten minutes
          with Uncle and every row uses your life instead.
        </p>
      </div>
      <PixButton asChild tone="white">
        <Link href="/onboarding">
          <Sprite art="uncle" scale={2} />
          Sit with Uncle
        </Link>
      </PixButton>
    </PixPanel>
  );
}

const MODES: { id: CommuteMode; label: string }[] = [
  { id: "car", label: "Car" },
  { id: "train", label: "Train" },
  { id: "fastest", label: "Faster" },
];

function SetupBar({
  ctx,
  onWork,
  onOfficeDays,
  onMode,
  ids,
  onAdd,
}: {
  ctx: BattleContext;
  onWork: (id: string) => void;
  onOfficeDays: (n: number) => void;
  onMode: (m: CommuteMode) => void;
  ids: string[];
  onAdd: (id: string) => void;
}) {
  const select =
    "pix-frame pix-flat block min-h-11 w-full cursor-pointer appearance-none px-3 py-2 text-sm font-semibold";
  const m = ctx.money;
  const moneyText =
    m.source === "bank"
      ? `Your bank check: up to about ${kRM(m.maxPriceRM)}`
      : m.source === "profile"
        ? `From what you told Uncle: up to about ${kRM(m.maxPriceRM)}`
        : `Sample payslip: up to about ${kRM(m.maxPriceRM)}`;
  return (
    <PixPanel
      flat
      tone="sky"
      className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_8rem_minmax(0,1fr)_minmax(0,1.3fr)]"
    >
      <label className="grid content-start gap-1.5">
        <span className="font-pixel-label text-[11px] uppercase">Work at</span>
        <select
          className={select}
          value={ctx.work.id}
          onChange={(e) => onWork(e.target.value)}
        >
          {anchorOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-soft">
          {ctx.workSource === "profile"
            ? `You told Uncle "${ctx.workLabel}"`
            : ctx.workSource === "picked"
              ? "Picked here"
              : "Default, until you tell Uncle"}
          {ctx.partner ? `. Partner: ${ctx.partner.name}` : ""}
        </span>
      </label>

      <label className="grid content-start gap-1.5">
        <span className="font-pixel-label text-[11px] uppercase">
          Office days
        </span>
        <select
          className={select}
          value={ctx.officeDays}
          onChange={(e) => onOfficeDays(Number(e.target.value))}
        >
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} a week
            </option>
          ))}
        </select>
      </label>

      <div className="grid content-start gap-1.5">
        <span
          id="mode-label"
          className="font-pixel-label text-[11px] uppercase"
        >
          Getting there
        </span>
        <div className="flex gap-2" role="group" aria-labelledby="mode-label">
          {MODES.map((o) => (
            <PixButton
              key={o.id}
              size="sm"
              tone={ctx.mode === o.id ? "kaya" : "white"}
              aria-pressed={ctx.mode === o.id}
              onClick={() => onMode(o.id)}
              className="min-h-11 flex-1 px-2"
            >
              {o.label}
            </PixButton>
          ))}
        </div>
        <span className="text-xs text-ink-soft">
          {ctx.modeSource === "profile"
            ? "As you told Uncle"
            : ctx.modeSource === "picked"
              ? "Picked here"
              : "Default"}
        </span>
      </div>

      <div className="grid content-start gap-1.5">
        <span className="font-pixel-label text-[11px] uppercase">
          Add a home ({ids.length} of {BATTLE_MAX})
        </span>
        {ids.length < BATTLE_MAX ? (
          <UnitSelect
            taken={ids}
            onChange={onAdd}
            label="Add a home to the battle"
            placeholder="Pick a home to add"
          />
        ) : (
          <p className="pix-frame pix-flat flex min-h-11 items-center px-3 text-sm text-ink-soft">
            Ring is full. Remove one to add.
          </p>
        )}
        <span
          className={cn(
            "text-xs",
            m.source === "sample" ? "font-semibold text-ink" : "text-ink-soft",
          )}
        >
          {moneyText}
          {m.source !== "bank" ? (
            <>
              {" · "}
              <Link
                href="/bank"
                className="underline decoration-2 underline-offset-4"
              >
                Run the bank check
              </Link>
            </>
          ) : null}
        </span>
      </div>
    </PixPanel>
  );
}

function NeedTwo({
  ids,
  onAdd,
}: {
  ids: string[];
  onAdd: (id: string) => void;
}) {
  return (
    <PixPanel className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_20rem] sm:items-center">
      <div className="grid gap-1">
        <h2 className="font-pixel text-2xl leading-tight">
          A battle needs two homes
        </h2>
        <p className="text-ink-soft">
          {ids.length === 1 ? "One home is in the ring. " : ""}Add another to
          see who wins, or go swipe and like a few.
        </p>
        <Link
          href="/swipe"
          className="w-fit text-sm font-semibold underline decoration-2 underline-offset-4"
        >
          Go to the swipe deck
        </Link>
      </div>
      <UnitSelect
        taken={ids}
        onChange={onAdd}
        label="Add a home to the battle"
        placeholder="Pick a home to add"
      />
    </PixPanel>
  );
}
