"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  PixButton,
  PixMeter,
  PixPanel,
  PixTag,
} from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { UnitPhoto } from "@/components/homelander/unit-photo";
import type { Battle, Fighter } from "@/lib/homelander/battle-verdict";
import type { FightRound, FightScript } from "@/lib/homelander/battle-fight";
import { cn } from "@/lib/utils";
import { crown, swords } from "./bits";
import { celebrateWinner, preloadConfetti } from "./celebrate";
import { useT } from "@/lib/homelander/i18n/client";

export type FightPhase = "idle" | "fighting" | "done";

/** Round length: 1.2-1.4 s, shorter when there are many rounds, so a fight stays under ~12 s. */
const roundMs = (n: number) => Math.max(1200, Math.min(1400, 9300 / n));
const INTRO_MS = 900;
const KO_MS = 1400;

const hpTone = (hp: number) => (hp > 50 ? "pandan" : hp > 25 ? "kaya" : "raya");

/**
 * The arcade fight. Idle: the fighters face off with a Start button. Fighting: a scripted bout,
 * round by round (see lib/homelander/battle-fight.ts for the honest damage maths). Done: the
 * K.O. card, the round-by-round results and Replay. Skip is always there.
 */
export function FightArena({
  battle,
  script,
  phase,
  run,
  reducedMotion,
  onStart,
  onDone,
}: {
  battle: Battle;
  script: FightScript;
  phase: FightPhase;
  /** Bumps on every start/replay, so the bout remounts and replays. */
  run: number;
  reducedMotion: boolean;
  onStart: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const fighters = battle.fighters;
  const n = fighters.length;

  return (
    <section aria-labelledby="fight-title" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2
          id="fight-title"
          className="flex items-center gap-3 font-pixel text-2xl leading-none lg:text-3xl"
        >
          <Sprite art={swords} scale={3} className="shrink-0 text-raya" />
          {t("The fight")}
        </h2>
        <p className="text-sm text-ink-soft">
          {t("{n} rounds, scored on your priorities. Damage comes from the real gaps in the table above.", { n: script.rounds.length })}
        </p>
      </div>

      <PixPanel tone="ink" className="grid gap-4 p-3 sm:p-5">
        {phase === "fighting" ? (
          <Bout key={run} battle={battle} script={script} onDone={onDone} />
        ) : (
          <Stage
            fighters={fighters}
            n={n}
            hp={phase === "done" ? script.finalHp : undefined}
            winnerId={phase === "done" ? script.winnerId : null}
            banner={
              phase === "done" ? (
                <KoBanner battle={battle} script={script} still />
              ) : (
                <div className="grid justify-items-center gap-1 text-center">
                  <p className="font-pixel text-3xl leading-none text-kaya sm:text-4xl">
                    {t("{n} homes enter the ring", { n })}
                  </p>
                  <p className="text-sm text-cloud">
                    {script.rounds.map((r) => t(r.title)).join(" · ")}
                  </p>
                </div>
              )
            }
          />
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {phase === "idle" ? (
            <>
              <PixButton
                tone="kaya"
                size="lg"
                onClick={onStart}
                onPointerEnter={preloadConfetti}
                onFocus={preloadConfetti}
              >
                <Sprite art={swords} scale={2} />
                {t("Start the battle")}
              </PixButton>
              <PixButton tone="white" onClick={onDone}>
                {t("Skip to the result")}
              </PixButton>
            </>
          ) : phase === "fighting" ? (
            <PixButton tone="white" onClick={onDone}>
              {t("Skip to the result")}
            </PixButton>
          ) : (
            <PixButton tone="kaya" onClick={onStart}>
              <Sprite art="undo" scale={2} />
              {t("Replay the fight")}
            </PixButton>
          )}
        </div>
        {reducedMotion && phase === "idle" ? (
          <p className="text-center text-xs text-cloud">
            Reduced motion is on: you&apos;ll get the round results as a list.
          </p>
        ) : null}
      </PixPanel>

      {phase === "done" ? <RoundList battle={battle} script={script} /> : null}
      {script.benched.length ? (
        <ul className="grid gap-1 text-sm text-ink-soft">
          {script.benched.map((b) => (
            <li key={b.key} className="flex items-start gap-2">
              <PixTag tone="white" className="shrink-0">
                {t("Benched")}
              </PixTag>
              <span>
                <span className="font-semibold text-ink">{t(b.label)}</span>{" "}
                {t("sits out: {why}.", { why: t(b.why) })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/* ---------------------------------------------------------------- the bout */

type Refs = Record<
  string,
  { card: HTMLDivElement | null; flash: HTMLSpanElement | null }
>;

function Bout({
  battle,
  script: live,
  onDone,
}: {
  battle: Battle;
  script: FightScript;
  onDone: () => void;
}) {
  const t = useT();
  // Freeze the script for this run, so a slider nudge mid-fight can't change the bout.
  const [script] = useState(live);
  const fighters = battle.fighters;
  const n = fighters.length;
  const [step, setStep] = useState(-1);
  const [hp, setHp] = useState<Record<string, number>>(() =>
    Object.fromEntries(fighters.map((f) => [f.unit.id, 100])),
  );
  const [struck, setStruck] = useState(false);
  const [ko, setKo] = useState(false);
  const refs = useRef<Refs>({});
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(window.setTimeout(fn, ms));
    const R = roundMs(script.rounds.length);
    const ids = fighters.map((f) => f.unit.id);
    const wide = window.matchMedia("(min-width: 640px)").matches;

    script.rounds.forEach((round, i) => {
      const t = INTRO_MS + i * R;
      at(t, () => {
        setStep(i);
        setStruck(false);
      });
      at(t + R * 0.3, () => {
        round.winners.forEach((id) => {
          const idx = ids.indexOf(id);
          const mid = (ids.length - 1) / 2;
          const dir = wide ? Math.sign(mid - idx) : 0;
          refs.current[id]?.card?.animate(
            [
              { transform: "translate(0,0) scale(1)" },
              {
                transform: `translate(${dir * 22}px,-14px) scale(1.12) rotate(${dir * 3}deg)`,
                offset: 0.45,
              },
              { transform: "translate(0,0) scale(1)" },
            ],
            { duration: 420, easing: "steps(6, end)" },
          );
        });
      });
      at(t + R * 0.48, () => {
        setStruck(true);
        setHp(round.hpAfter);
        ids.forEach((id) => {
          if ((round.damage[id] ?? 0) < 0.5) return;
          const r = refs.current[id];
          r?.card?.animate(
            [
              { transform: "translateX(0)" },
              { transform: "translateX(-7px)" },
              { transform: "translateX(6px)" },
              { transform: "translateX(-4px)" },
              { transform: "translateX(3px)" },
              { transform: "translateX(0)" },
            ],
            { duration: 360, easing: "steps(5, end)" },
          );
          r?.flash?.animate(
            [{ opacity: 0 }, { opacity: 0.65 }, { opacity: 0 }],
            {
              duration: 300,
              easing: "steps(3, end)",
            },
          );
        });
      });
    });

    const end = INTRO_MS + script.rounds.length * R;
    at(end, () => {
      setKo(true);
      const rect =
        refs.current[script.winnerId]?.card?.getBoundingClientRect() ?? null;
      void celebrateWinner(rect);
    });
    at(end + KO_MS, () => doneRef.current());
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [script, fighters]);

  const round: FightRound | null = step >= 0 ? script.rounds[step]! : null;

  return (
    <Stage
      fighters={fighters}
      n={n}
      hp={hp}
      winnerId={ko ? script.winnerId : null}
      round={ko ? null : round}
      struck={struck}
      refs={refs}
      banner={
        ko ? (
          <KoBanner battle={battle} script={script} />
        ) : round ? (
          <RoundBanner
            round={round}
            index={step}
            fighters={fighters}
            struck={struck}
          />
        ) : (
          <div className="grid justify-items-center gap-1 text-center">
            <p className="font-pixel text-4xl leading-none text-kaya sm:text-5xl">
              {t("Ready? Fight!")}
            </p>
          </div>
        )
      }
    />
  );
}

/* ---------------------------------------------------------------- pieces */

function Stage({
  fighters,
  n,
  hp,
  winnerId,
  round,
  struck,
  refs,
  banner,
}: {
  fighters: Fighter[];
  n: number;
  hp?: Record<string, number>;
  winnerId: string | null;
  round?: FightRound | null;
  struck?: boolean;
  refs?: React.RefObject<Refs>;
  banner: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="grid gap-4">
      <div
        aria-live="polite"
        className="grid min-h-[6.5rem] place-items-center rounded-lg border-2 border-dashed border-cloud/30 px-3 py-3"
      >
        {banner}
      </div>
      <ul
        className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(var(--n),minmax(0,1fr))] sm:gap-4"
        style={{ "--n": n } as CSSProperties}
      >
        {fighters.map((f, i) => {
          const id = f.unit.id;
          const h = hp?.[id] ?? 100;
          const isWinner = winnerId === id;
          const won = round?.winners.includes(id) ?? false;
          const lost = Boolean(
            struck && round && (round.damage[id] ?? 0) >= 0.5,
          );
          return (
            <li
              key={id}
              className={cn(n === 5 && i === 4 && "col-span-2 sm:col-span-1")}
            >
              <div
                ref={(el) => {
                  if (!refs) return;
                  refs.current[id] = {
                    ...refs.current[id],
                    card: el,
                    flash: refs.current[id]?.flash ?? null,
                  };
                }}
                className="relative"
              >
                <PixPanel
                  tone={isWinner ? "kaya" : "white"}
                  className={cn(
                    "relative grid gap-2 overflow-hidden p-2.5 sm:p-3",
                    winnerId && !isWinner && "opacity-60 grayscale",
                  )}
                >
                  <div className="relative">
                    <UnitPhoto
                      photo={f.unit.photo}
                      alt={f.unit.photoAlt}
                      width={280}
                      height={175}
                      className="pix-img aspect-[16/10] w-full rounded-md border-2 border-ink object-cover"
                    />
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-ink px-1.5 py-0.5 font-pixel text-[11px] leading-none text-white">
                      P{i + 1}
                    </span>
                    {isWinner ? (
                      <PixTag
                        tone="kaya"
                        className="absolute top-1.5 right-1.5"
                      >
                        <Sprite art={crown} scale={1.5} className="text-ink" />
                        {t("Winner")}
                      </PixTag>
                    ) : won && round ? (
                      <PixTag
                        tone="pandan"
                        className="absolute top-1.5 right-1.5"
                      >
                        <Sprite art="star" scale={1.5} className="text-ink" />
                        {t("Strike")}
                      </PixTag>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 min-h-[2.5em] font-pixel text-sm leading-tight sm:text-[15px]">
                    {f.unit.name}
                  </p>
                  <div className="grid gap-1">
                    <span className="flex items-baseline justify-between font-pixel-label text-[10px] uppercase">
                      HP
                      <span className="font-pixel text-base leading-none tabular-nums">
                        {Math.round(h)}
                      </span>
                    </span>
                    <PixMeter
                      value={h}
                      tone={hpTone(h)}
                      label={t("{name} HP {n} of 100", { name: f.unit.name, n: Math.round(h) })}
                    />
                  </div>
                  <p
                    className={cn(
                      "min-h-[2.4em] text-xs leading-tight font-semibold tabular-nums",
                      round
                        ? won
                          ? "text-pandan-deep"
                          : lost
                            ? "text-raya-deep"
                            : "text-ink"
                        : "text-ink-soft",
                    )}
                  >
                    {round ? round.figures[id] : `${f.township.name}`}
                    {lost && round ? (
                      <span className="block font-pixel text-sm text-raya-deep">
                        −{Math.max(1, Math.round(round.damage[id] ?? 0))} HP
                      </span>
                    ) : null}
                  </p>
                  <span
                    ref={(el) => {
                      if (!refs) return;
                      refs.current[id] = {
                        card: refs.current[id]?.card ?? null,
                        flash: el,
                      };
                    }}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-raya opacity-0"
                  />
                </PixPanel>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoundBanner({
  round,
  index,
  fighters,
  struck,
}: {
  round: FightRound;
  index: number;
  fighters: Fighter[];
  struck: boolean;
}) {
  const t = useT();
  const names = round.winners
    .map((id) => fighters.find((f) => f.unit.id === id)?.unit.name)
    .filter(Boolean);
  return (
    <div className="grid justify-items-center gap-1.5 text-center">
      <p className="font-pixel text-2xl leading-none text-kaya sm:text-4xl">
        {t("Round {n}: {title}", { n: index + 1, title: t(round.title) })}
      </p>
      <p className="text-xs text-cloud sm:text-sm">{t(round.hint)}</p>
      <p className="hidden font-pixel text-base leading-tight text-white tabular-nums sm:block">
        {fighters.map((f) => round.figures[f.unit.id]).join(" vs ")}
      </p>
      <p className="min-h-[1.25em] text-sm font-semibold text-pandan">
        {struck
          ? names.length
            ? t(names.length === 1 ? "{names} takes the round" : "{names} share the round", { names: names.join(" & ") })
            : t("Draw: nobody lands a hit")
          : ""}
      </p>
    </div>
  );
}

function KoBanner({
  battle,
  script,
  still,
}: {
  battle: Battle;
  script: FightScript;
  still?: boolean;
}) {
  const t = useT();
  const w = battle.winner;
  const ru = battle.runnerUp;
  return (
    <div className="grid justify-items-center gap-1.5 text-center">
      <p
        className={cn(
          "font-pixel leading-none text-raya",
          still ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl",
        )}
      >
        K.O.!
      </p>
      <p className="font-pixel text-xl leading-tight text-kaya sm:text-2xl">
        {w.unit.name} {w.soldOut ? t("scores best, but it's sold out") : t("wins")}
      </p>
      {ru ? (
        <p className="text-sm text-cloud tabular-nums">
          {t("{a} HP left vs {b} for {name}", { a: Math.round(script.finalHp[w.unit.id] ?? 0), b: Math.round(script.finalHp[ru.unit.id] ?? 0), name: ru.unit.name })}
          {script.tieBreak
            ? `. ${t("Level on points; the swipe match breaks the tie")}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

/** Round by round, as a list: the reduced-motion fight, and the recap after any fight. */
function RoundList({
  battle,
  script,
}: {
  battle: Battle;
  script: FightScript;
}) {
  const t = useT();
  const name = (id: string) =>
    battle.fighters.find((f) => f.unit.id === id)?.unit.name ?? id;
  return (
    <PixPanel flat className="grid gap-2 p-4">
      <h3 className="font-pixel text-lg leading-none">{t("Round by round")}</h3>
      <ol className="grid gap-2 text-sm">
        {script.rounds.map((r, i) => (
          <li
            key={r.kind}
            className="grid gap-0.5 border-b border-dotted border-ink/25 pb-2 last:border-0 last:pb-0 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-3"
          >
            <span className="font-pixel text-base leading-tight">
              {i + 1}. {t(r.title)}
            </span>
            <span className="grid gap-0.5">
              <span className="font-semibold">
                {r.winners.length
                  ? t(r.winners.length === 1 ? "{names} wins" : "{names} share it", { names: r.winners.map(name).join(" & ") })
                  : t("Draw")}
              </span>
              <span className="text-ink-soft tabular-nums">
                {battle.fighters
                  .map((f) => `${f.unit.name}: ${r.figures[f.unit.id]}`)
                  .join(" · ")}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-soft">
        {t("Each home loses HP by how far it trails the round's best score, times your priority weight. The HP left is the same order as the overall score.")}
      </p>
    </PixPanel>
  );
}
