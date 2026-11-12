"use client";

import Link from "next/link";
import { useState } from "react";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { anchorOptions, rm, unitById, units, type Unit } from "@/lib/homelander/data";
import {
  analysisContext,
  battle,
  PRESETS,
  startingLineup,
  STATS,
  type LineupSource,
  type PresetId,
  type Weights,
} from "@/lib/homelander/analysis";
import { homelander, useHomeLander } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";
import { swords } from "./bits";
import { FighterCard } from "./fighter-card";
import { HeadToHead } from "./head-to-head";
import { VerdictBox } from "./verdict-box";

const isUnit = (id: string) => id in unitById;

const sourceCopy: Record<LineupSource, { tag: string; tone: "kaya" | "pandan" | "lilac"; text: string }> = {
  sample: { tag: "Sample lineup", tone: "kaya", text: "You have not liked two homes yet, so here is a sample lineup." },
  mixed: { tag: "1 like + sample", tone: "kaya", text: "Your one like, padded with sample fighters." },
  liked: { tag: "From your likes", tone: "pandan", text: "Your first liked homes." },
  picks: { tag: "Your picks", tone: "lilac", text: "The fighters you picked." },
};

export function BattleView() {
  const s = useHomeLander();
  const { ids, source } = startingLineup(s, isUnit);
  const list = ids.map((id) => unitById[id]) as Unit[];

  const [officeDays, setOfficeDays] = useState<number | null>(null);
  const [mode, setMode] = useState<PresetId | "custom" | null>(null);
  const [custom, setCustom] = useState<Weights>(PRESETS.time.weights);

  const autoPreset: PresetId = s.answers?.priority === "space" ? "space" : "time";
  const activePreset = mode ?? autoPreset;
  const weights = activePreset === "custom" ? custom : PRESETS[activePreset].weights;

  const ctx = analysisContext(s, { officeDays: officeDays ?? undefined });
  const result = battle(list, ctx, weights);
  const winnerId = result.winner.unit.id;

  const save = (next: string[]) => homelander.setCompare(next);
  const swap = (slot: number, id: string) => {
    const next = [...ids];
    const other = next.indexOf(id);
    if (other >= 0) next[other] = next[slot]!;
    next[slot] = id;
    save(next);
  };
  const remove = (slot: number) => save(ids.filter((_, i) => i !== slot));
  const addFighter = () => {
    const extra = units.find((u) => !ids.includes(u.id) && u.id !== "kundang-sd");
    if (extra) save([...ids, extra.id]);
  };

  const setWeight = (key: keyof Weights, v: number) => {
    setCustom({ ...weights, [key]: v });
    setMode("custom");
  };

  const src = sourceCopy[source];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:gap-10">
      {/* Title */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="grid gap-2">
          <h1 className="flex items-center gap-3 font-pixel text-3xl leading-none font-bold lg:text-5xl">
            <Sprite art={swords} scale={4} className="shrink-0 text-ink" />
            Battle of the homes
          </h1>
          <p className="max-w-2xl text-ink-soft">
            {result.fighters.length} Gamuda Land homes go head to head on commute, space, money and more. HomeLander
            calls the winner. All units and prices are sample data.
          </p>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <PixTag tone={src.tone}>{src.tag}</PixTag>
            <span className="text-ink-soft">{src.text}</span>
            {source === "sample" || source === "mixed" ? (
              <Link href="/swipe" className="font-medium underline decoration-2 underline-offset-4">
                Swipe to pick your own
              </Link>
            ) : null}
          </p>
        </div>
        <ContextBar
          anchorId={ctx.anchorId}
          onAnchor={(id) => homelander.anchors(id, s.secondAnchorId)}
          officeDays={ctx.officeDays}
          onOfficeDays={setOfficeDays}
          moneyFromBank={ctx.money.source === "bank"}
          maxPrice={ctx.money.maxPriceRM}
          modeNote={ctx.mode ? `by ${ctx.mode}, as you told us` : "faster of car or train"}
        />
      </div>

      {/* Fighters */}
      <section aria-label="Fighters" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
        <p className="text-sm text-ink-soft lg:hidden">Swipe sideways to see every fighter.</p>
        <div
          className={cn(
            "-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pt-1 pb-6",
            "lg:mx-0 lg:grid lg:gap-10 lg:overflow-visible lg:px-0",
            result.fighters.length === 2 ? "lg:grid-cols-[1fr_1fr_14rem]" : "lg:grid-cols-3",
          )}
        >
          {result.fighters.map((f, i) => (
            <div key={i} className="relative w-[84%] max-w-sm shrink-0 snap-center sm:w-[58%] lg:w-auto lg:max-w-none">
              {i > 0 ? (
                <span
                  aria-hidden
                  className="absolute top-1/3 -left-[38px] z-20 hidden size-9 items-center justify-center border-[3px] border-ink bg-raya font-pixel text-base text-white lg:flex"
                >
                  VS
                </span>
              ) : null}
              <FighterCard
                fighter={f}
                slot={i}
                isWinner={f.unit.id === winnerId}
                winnerId={winnerId}
                lineup={ids}
                onSwap={(id) => swap(i, id)}
                onRemove={ids.length > 2 ? () => remove(i) : undefined}
              />
            </div>
          ))}
          {ids.length < 3 ? (
            <div className="flex w-[70%] max-w-xs shrink-0 snap-center pt-7 sm:w-[40%] lg:w-auto">
              <button
                type="button"
                onClick={addFighter}
                className="flex w-full flex-col items-center justify-center gap-3 border-[3px] border-dashed border-ink bg-white/50 p-6 font-pixel text-lg hover:bg-white/80"
              >
                <Sprite art="sparkle" scale={5} className="text-ink" />
                Add a 3rd fighter
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* Verdict + weights */}
      <div className="grid gap-8 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <VerdictBox key={winnerId} battle={result} />
        <WeightsPanel active={activePreset} weights={weights} onPreset={setMode} onWeight={setWeight} />
      </div>

      <HeadToHead fighters={result.fighters} ctx={ctx} winnerId={winnerId} />
    </div>
  );
}

function ContextBar({
  anchorId,
  onAnchor,
  officeDays,
  onOfficeDays,
  moneyFromBank,
  maxPrice,
  modeNote,
}: {
  anchorId: string;
  onAnchor: (id: string) => void;
  officeDays: number;
  onOfficeDays: (n: number) => void;
  moneyFromBank: boolean;
  maxPrice: number;
  modeNote: string;
}) {
  const select =
    "pix-frame pix-flat block w-full cursor-pointer appearance-none px-2.5 py-1.5 font-pixel text-base leading-tight";
  return (
    <PixPanel flat tone="sky" className="grid gap-3 p-3 text-sm lg:w-[22rem]">
      <div className="grid grid-cols-[1fr_6.5rem] gap-3">
        <label className="grid gap-1.5">
          <span className="font-pixel-label text-[11px] uppercase">Work at</span>
          <select className={select} value={anchorId} onChange={(e) => onAnchor(e.target.value)}>
            {anchorOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="font-pixel-label text-[11px] uppercase">Office days</span>
          <select className={select} value={officeDays} onChange={(e) => onOfficeDays(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} a week
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-ink-soft">
        Commute score uses the {modeNote}.{" "}
        {moneyFromBank ? (
          <>Money uses your bank check (up to about {rm(maxPrice)}).</>
        ) : (
          <>
            Money uses a sample payslip.{" "}
            <Link href="/bank" className="font-medium text-ink underline decoration-2 underline-offset-4">
              Use yours
            </Link>
          </>
        )}
      </p>
    </PixPanel>
  );
}

function WeightsPanel({
  active,
  weights,
  onPreset,
  onWeight,
}: {
  active: PresetId | "custom";
  weights: Weights;
  onPreset: (p: PresetId) => void;
  onWeight: (k: keyof Weights, v: number) => void;
}) {
  return (
    <PixPanel className="grid gap-4 p-4" aria-labelledby="weights-title">
      <div className="grid gap-1">
        <h2 id="weights-title" className="font-pixel text-xl leading-none">
          What matters most?
        </h2>
        <p className="text-sm text-ink-soft">Pick a play style, or tune each stat yourself.</p>
      </div>
      <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Presets">
        {(Object.keys(PRESETS) as PresetId[]).map((p) => (
          <PixButton
            key={p}
            size="sm"
            tone={active === p ? "kaya" : "white"}
            aria-pressed={active === p}
            onClick={() => onPreset(p)}
            className="min-h-11 px-1.5 text-center text-sm leading-tight"
          >
            {PRESETS[p].label}
          </PixButton>
        ))}
      </div>
      <p className="text-xs text-ink-soft">
        {active === "custom" ? "Your own mix." : PRESETS[active].blurb + "."}
      </p>
      <ul className="grid gap-2.5">
        {STATS.map((s) => (
          <li key={s.key} className="grid grid-cols-[5rem_1fr_1.5rem] items-center gap-3">
            <label htmlFor={`w-${s.key}`} className="font-pixel-label text-[11px] uppercase">
              {s.label}
            </label>
            <input
              id={`w-${s.key}`}
              type="range"
              min={0}
              max={10}
              step={1}
              value={weights[s.key]}
              onChange={(e) => onWeight(s.key, Number(e.target.value))}
              className="h-6 w-full cursor-pointer accent-ink"
              aria-describedby={`w-${s.key}-hint`}
            />
            <span className="text-right font-pixel text-base tabular-nums">{weights[s.key]}</span>
            <span id={`w-${s.key}-hint`} className="sr-only">
              {s.hint}
            </span>
          </li>
        ))}
      </ul>
    </PixPanel>
  );
}
