"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePrefersReducedMotion } from "@/components/first-key/use-reduced-motion";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { MochiBot } from "@/components/homelander/mochi-bot";
import { Sprite } from "@/components/homelander/sprite";
import {
  analyseHome,
  PRESETS,
  mochiWeights,
  type StatKey,
  type Weights,
} from "@/lib/homelander/analysis";
import {
  battleContext,
  budgetForMatch,
  type BattleContext,
  type CommuteMode,
} from "@/lib/homelander/battle-context";
import { fightScript } from "@/lib/homelander/battle-fight";
import {
  BATTLE_MAX,
  BATTLE_MIN,
  runBattle,
  startingLineup,
  type LineupSource,
} from "@/lib/homelander/battle-verdict";
import { anchorOptions, unitById, type Unit } from "@/lib/homelander/data";
import { realUnits, recommend } from "@/lib/homelander/recommend";
import { homelander, useHomeLander } from "@/lib/homelander/store";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import { kRM, swords, UnitSelect } from "./bits";
import { FightArena, type FightPhase } from "./fight-arena";
import { HeadToHead } from "./head-to-head";
import { Priorities, type WeightMode } from "./priorities";
import { VerdictBox } from "./verdict-box";

/** Only real Gamuda Land homes (published figures) can enter the ring. */
const realIds = new Set(realUnits.map((u) => u.id));
const isUnit = (id: string) => realIds.has(id);

const sourceCopy: Record<
  LineupSource,
  { tag: string; tone: "kaya" | "pandan" | "lilac"; text: string }
> = {
  few: {
    tag: "Need 2 homes",
    tone: "kaya",
    text: "A battle needs at least two homes you picked.",
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

const noop = () => () => {};
/** False during the server render and hydration, when the store still shows its empty state. */
const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

/**
 * Battle of the homes. Page order: title + lineup and settings, then the head-to-head table
 * (no winner shown), then the fight, and only after the fight the verdict. Runs only on what the
 * buyer really told Mochi: no sample payslip, default office or default office days.
 */
export function BattleView() {
  const t = useT();
  const s = useHomeLander();
  const reducedMotion = usePrefersReducedMotion();
  const hydrated = useHydrated();

  const [workId, setWorkId] = useState<string | null>(null);
  const [officeDays, setOfficeDays] = useState<number | null>(null);
  const [mode, setMode] = useState<CommuteMode | null>(null);
  const [weightMode, setWeightMode] = useState<WeightMode>("mochi");
  const [custom, setCustom] = useState<Weights | null>(null);
  const [fight, setFight] = useState<{
    key: string;
    phase: FightPhase;
    run: number;
  }>({ key: "", phase: "idle", run: 0 });

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

  const mochi = mochiWeights(ctx, list[0] ? analyseHome(list[0], ctx) : null);
  const weights: Weights =
    weightMode === "custom" && custom
      ? custom
      : weightMode === "mochi" || weightMode === "custom"
        ? mochi.weights
        : PRESETS[weightMode].weights;

  const result =
    ctx.onboarded && list.length >= BATTLE_MIN
      ? runBattle(list, ctx, weights, (u) => matchById.get(u.id) ?? 0)
      : null;
  const script = result ? fightScript(result, ctx) : null;

  // The fight belongs to this lineup: change the lineup and the result is sealed again.
  const lineupKey = ids.join("|");
  const phase: FightPhase = fight.key === lineupKey ? fight.phase : "idle";
  const revealed = phase === "done";
  const start = () =>
    setFight((f) => ({
      key: lineupKey,
      phase: reducedMotion ? "done" : "fighting",
      run: f.run + 1,
    }));
  const finish = () =>
    setFight((f) => ({ ...f, key: lineupKey, phase: "done" }));

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
    likedTop.length >= BATTLE_MIN &&
    likedTop.join() !== ids.join();

  const src = sourceCopy[source];

  const title = (
    <header className="grid gap-2">
      <h1 className="flex items-center gap-3 font-pixel text-3xl leading-none lg:text-5xl">
        <Sprite art={swords} scale={4} className="shrink-0 text-pandan-deep" />
        {t("Battle of the homes")}
      </h1>
      <p className="max-w-3xl text-ink-soft">
        {t("Up to {n} Gamuda Land homes you picked, side by side on what you'd pay every month, how long you'd spend getting to work, room for the family and the home itself. Compare them first, then let them fight it out.", { n: BATTLE_MAX })}
      </p>
      {ctx.onboarded ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <PixTag tone={src.tone}>{t(src.tag)}</PixTag>
          <span className="text-ink-soft">{t(src.text)}</span>
          {canUseLikes ? (
            <button
              type="button"
              onClick={() => save(likedTop)}
              className="font-semibold underline decoration-2 underline-offset-4"
            >
              {t("Use my top {n} likes", { n: likedTop.length })}
            </button>
          ) : null}
        </p>
      ) : null}
    </header>
  );

  // Until the saved state is read, show nothing rather than flash the "know you first" gate.
  if (!hydrated)
    return <div className="grid grid-cols-[minmax(0,1fr)] gap-6">{title}</div>;

  if (!ctx.onboarded)
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:gap-8">
        {title}
        <Gate />
      </div>
    );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:gap-8">
      {title}

      {ctx.missing.length ? <Missing ctx={ctx} /> : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
        <SetupBar
          ctx={ctx}
          onWork={setWorkId}
          onOfficeDays={setOfficeDays}
          onMode={setMode}
          ids={ids}
          onAdd={add}
        />
        {result ? (
          <Priorities
            mode={weightMode}
            weights={weights}
            mochiWhy={mochi.why}
            hasProfile={ctx.hasProfile}
            skipped={result.skipped}
            onPreset={(p) => setWeightMode(p)}
            onWeight={setWeight}
          />
        ) : null}
      </div>

      {result && script ? (
        <>
          <HeadToHead
            fighters={result.fighters}
            ctx={ctx}
            winnerId={revealed ? result.winner.unit.id : ""}
            revealed={revealed}
            weights={result.weights}
            skipped={result.skipped}
            lineup={ids}
            onSwap={swap}
            onRemove={remove}
          />
          <FightArena
            battle={result}
            script={script}
            phase={phase}
            run={fight.run}
            reducedMotion={reducedMotion}
            onStart={start}
            onDone={finish}
          />
          {revealed ? (
            <Reveal
              key={`${lineupKey}:${fight.run}`}
              reducedMotion={reducedMotion}
            >
              <VerdictBox battle={result} ctx={ctx} />
            </Reveal>
          ) : null}
        </>
      ) : (
        <NeedTwo ids={ids} onAdd={add} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

/** The verdict slides in (and scrolls into view) once the fight is over. */
function Reveal({
  children,
  reducedMotion,
}: {
  children: React.ReactNode;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    if (reducedMotion) return;
    el.animate(
      [
        { opacity: 0, transform: "translateY(32px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 480, easing: "steps(8, end)" },
    );
  }, [reducedMotion]);
  return (
    <div ref={ref} className="scroll-mt-24">
      {children}
    </div>
  );
}

function Gate() {
  const t = useT();
  return (
    <PixPanel
      tone="kaya"
      className="grid gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-6 sm:p-6"
    >
      <MochiBot size={120} className="justify-self-center" />
      <div className="grid gap-3">
        <h2 className="font-pixel text-2xl leading-tight lg:text-3xl">
          {t("Mochi needs to get to know you first")}
        </h2>
        <p className="max-w-2xl">
          {t("A battle on guesses is no battle. Chat with Mochi for ten minutes: where you work, who you live with, what you earn and what you've saved. Then every row and every round uses your life, not a sample.")}
        </p>
        <div className="flex flex-wrap gap-3">
          <PixButton asChild tone="white" size="lg">
            <Link href="/onboarding">
              <Sprite art="mochi" scale={2} />
              {t("Chat with Mochi")}
            </Link>
          </PixButton>
        </div>
      </div>
    </PixPanel>
  );
}

function Missing({ ctx }: { ctx: BattleContext }) {
  const t = useT();
  return (
    <PixPanel
      tone="kaya"
      flat
      className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-5"
    >
      <MochiBot size={72} label="" className="hidden sm:block" />
      <div className="grid gap-1">
        <p className="font-pixel text-lg leading-tight">
          {t("Mochi doesn't know everything yet")}
        </p>
        <p className="text-sm">
          {t("Still missing: {list}. We don't guess these: the rows that need them say so, and the fight leaves those rounds out.", { list: ctx.missing.map((m) => t(m)).join(", ") })}
        </p>
      </div>
      <PixButton asChild tone="white">
        <Link href="/onboarding">
          <Sprite art="mochi" scale={2} />
          {t("Tell Mochi")}
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
  const t = useT();
  const select =
    "pix-frame pix-flat block min-h-11 w-full cursor-pointer appearance-none px-3 py-2 text-sm font-semibold";
  const m = ctx.money;
  const moneyText =
    m.source === "bank"
      ? t("Your bank check: up to about {amt}", { amt: kRM(m.maxPriceRM) })
      : m.source === "profile"
        ? t("From what you told Mochi: up to about {amt}", { amt: kRM(m.maxPriceRM) })
        : t("Mochi doesn't know your salary yet, so budget isn't judged");
  return (
    <PixPanel
      flat
      tone="sky"
      className="grid content-start gap-4 p-4 md:grid-cols-2"
    >
      <label className="grid content-start gap-1.5">
        <span className="font-pixel-label text-[11px] uppercase">{t("Work at")}</span>
        <select
          className={select}
          value={ctx.work?.id ?? ""}
          onChange={(e) => onWork(e.target.value)}
        >
          {ctx.work ? null : (
            <option value="" disabled>
              {t("Pick where you work")}
            </option>
          )}
          {anchorOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-soft">
          {ctx.workSource === "profile"
            ? t("You told Mochi \"{name}\"", { name: ctx.workLabel ?? "" })
            : ctx.workSource === "picked"
              ? t("Picked here")
              : ctx.workUnmapped
                ? t("\"{name}\" isn't on our map: pick the closest", { name: ctx.workUnmapped })
                : t("Not told Mochi yet: no commute rows until you pick")}
          {ctx.partner ? `. ${t("Partner: {name}", { name: ctx.partner.name })}` : ""}
        </span>
      </label>

      <label className="grid content-start gap-1.5">
        <span className="font-pixel-label text-[11px] uppercase">
          {t("Office days")}
        </span>
        <select
          className={select}
          value={ctx.officeDays ?? ""}
          onChange={(e) => onOfficeDays(Number(e.target.value))}
        >
          {ctx.officeDays === null ? (
            <option value="" disabled>
              {t("Pick")}
            </option>
          ) : null}
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {t("{n} a week", { n })}
            </option>
          ))}
        </select>
      </label>

      <div className="grid content-start gap-1.5">
        <span
          id="mode-label"
          className="font-pixel-label text-[11px] uppercase"
        >
          {t("Getting there")}
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
              {t(o.label)}
            </PixButton>
          ))}
        </div>
        <span className="text-xs text-ink-soft">
          {ctx.modeSource === "profile"
            ? t("As you told Mochi")
            : ctx.modeSource === "picked"
              ? t("Picked here")
              : t("Not told Mochi yet")}
        </span>
      </div>

      <div className="grid content-start gap-1.5">
        <span className="font-pixel-label text-[11px] uppercase">
          {t("Add a home ({n} of {max})", { n: ids.length, max: BATTLE_MAX })}
        </span>
        {ids.length < BATTLE_MAX ? (
          <UnitSelect
            taken={ids}
            onChange={onAdd}
            label={t("Add a home to the battle")}
            placeholder={t("Pick a home to add")}
          />
        ) : (
          <p className="pix-frame pix-flat flex min-h-11 items-center px-3 text-sm text-ink-soft">
            {t("Ring is full. Remove one to add.")}
          </p>
        )}
        <span
          className={cn(
            "text-xs",
            m.source === "missing" ? "font-semibold text-ink" : "text-ink-soft",
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
                {t("Run the bank check")}
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
  const t = useT();
  const inRing = ids.map((id) => unitById[id]?.name).filter(Boolean);
  return (
    <PixPanel className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_20rem] sm:items-center">
      <div className="grid gap-2">
        <h2 className="font-pixel text-2xl leading-tight">
          {t("Pick at least {n} homes to battle", { n: BATTLE_MIN })}
        </h2>
        <p className="text-ink-soft">
          {inRing.length
            ? `${t("Only {list} is in the ring.", { list: inRing.join(", ") })} `
            : `${t("The ring is empty.")} `}
          {t("Like a few homes on the swipe deck and they line up here, or add one you already know.")}
        </p>
        <PixButton asChild tone="kaya" className="w-fit">
          <Link href="/swipe">
            <Sprite art="heart" scale={2} />
            {t("Go to the swipe deck")}
          </Link>
        </PixButton>
      </div>
      <UnitSelect
        taken={ids}
        onChange={onAdd}
        label={t("Add a home to the battle")}
        placeholder={t("Pick a home to add")}
      />
    </PixPanel>
  );
}
