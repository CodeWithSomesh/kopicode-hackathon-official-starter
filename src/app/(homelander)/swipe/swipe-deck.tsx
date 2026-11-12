"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { anchorOptions, availabilityOf, passReasons, rm, townshipById, unitById, type Unit } from "@/lib/homelander/data";
import { BATTLE_MAX, DECK_LIKE_LIMIT, LIKES_TO_BATTLE, anchorFor, recommend } from "@/lib/homelander/recommend";
import { homelander, useHomeLander } from "@/lib/homelander/store";
import { moneyBasis } from "./_swipe/buyer";
import { CardStack, type Dir, type StackHandle } from "./_swipe/card-stack";
import { celebrateLike, preloadConfetti } from "./_swipe/confetti";
import { EncounterCard } from "./_swipe/encounter-card";
import { Controls, EndOfDeck, Insights, Shortlist, matchesFilter, type StockFilter } from "./_swipe/panels";
import { swipeSprites } from "./_swipe/sprites";

/**
 * The swipe deck: Uncle's picks, best match first, one home at a time.
 * Right = like (confetti!) or "notify me" when sold out; left = pass, then optionally say why.
 * Up (or tap the card) flips to the details worked out for this buyer.
 * Desktop: deck on the left, filters / insights / shortlist on the right. Phones: one column.
 */
export function SwipeDeck() {
  const s = useHomeLander();
  const router = useRouter();
  const stack = useRef<StackHandle>(null);
  const [filter, setFilter] = useState<StockFilter>("all");
  /** Sold-out units the buyer asked to be notified about, this visit only (nothing is stored). */
  const [notified, setNotified] = useState<{ id: string; atHistory: number }[]>([]);
  const [askReasonFor, setAskReasonFor] = useState<string | null>(null);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  useEffect(preloadConfetti, []);

  const uncleAnchor = anchorFor(s.profile.workArea);
  const anchor = uncleAnchor ?? anchorOptions.find((a) => a.id === s.anchorId) ?? anchorOptions[0]!;
  // Uncle's order: best match for this buyer first.
  const picks = useMemo(() => recommend(s.profile, s.budget, anchor), [s.profile, s.budget, anchor]);
  const pickById = useMemo(() => new Map(picks.map((p) => [p.unit.id, p])), [picks]);
  const basis = useMemo(() => moneyBasis(s.profile, s.budget), [s.profile, s.budget]);
  const units = picks.map((p) => p.unit);
  const likedByMatch = [...s.liked].sort((a, b) => (pickById.get(b)?.score ?? 0) - (pickById.get(a)?.score ?? 0));
  const full = s.liked.length >= DECK_LIKE_LIMIT;

  const seen = new Set([...s.history, ...notified.map((n) => n.id)]);
  const unseen = units.filter((u) => !seen.has(u.id));
  const queue = full ? [] : unseen.filter((u) => matchesFilter(u.id, filter));
  const top = queue[0];
  const topSold = top ? availabilityOf(top.id).status === "Sold out" : false;
  const open = !!top && detailsFor === top.id;
  const counts = {
    all: unseen.length,
    available: unseen.filter((u) => matchesFilter(u.id, "available")).length,
    few: unseen.filter((u) => matchesFilter(u.id, "few")).length,
  };
  const position = units.length - unseen.length + 1;

  function goBattle() {
    const ranked = [...homelander.snapshot().liked].sort(
      (a, b) => (pickById.get(b)?.score ?? 0) - (pickById.get(a)?.score ?? 0),
    );
    homelander.setCompare(ranked.slice(0, BATTLE_MAX));
    router.push("/battle");
  }

  /** The card is on its way out: celebrate a like now, so it lands with the gesture. */
  function onRelease(dir: Dir, unit: Unit, rect: DOMRect | null) {
    setDetailsFor(null);
    const sold = availabilityOf(unit.id).status === "Sold out";
    if (dir !== "right" || sold) return;
    const likes = homelander.snapshot().liked.filter((id) => id !== unit.id).length + 1;
    void celebrateLike(rect, likes);
  }

  /** The card has left: record the decision. */
  function onDone(dir: Dir, unit: Unit) {
    const sold = availabilityOf(unit.id).status === "Sold out";
    const name = townshipById[unit.townshipId]?.name ?? unit.name;
    if (dir === "right" && sold) {
      setNotified((n) => [...n, { id: unit.id, atHistory: homelander.snapshot().history.length }]);
      setAskReasonFor(null);
      toast.success(`Okay, we'll ping you if a ${unit.name} frees up.`, {
        description: "Demo only: no alert is actually set.",
      });
      setAnnounce(`Notify me set for ${unit.name}.`);
    } else if (dir === "right") {
      homelander.like(unit.id);
      setAskReasonFor(null);
      const likes = homelander.snapshot().liked.length;
      setAnnounce(`Liked ${name}. ${likes} on your shortlist.`);
      if (likes === LIKES_TO_BATTLE) {
        toast.success("Battle unlocked!", {
          description: "Three homes liked. Make them fight it out, or keep swiping.",
          action: { label: "Battle", onClick: goBattle },
        });
      } else if (likes === DECK_LIKE_LIMIT) {
        toast.success("Ten suka! Your shortlist is full.", {
          description: `Your top ${BATTLE_MAX} by match go into Battle.`,
          action: { label: "Battle", onClick: goBattle },
        });
      }
    } else {
      homelander.pass(unit.id);
      setAskReasonFor(unit.id);
      setAnnounce(`Passed on ${name}.`);
    }
  }

  function decide(dir: Dir) {
    if (!top) return;
    stack.current?.fling(dir);
  }

  function undo() {
    const lastNotify = notified.at(-1);
    let back: { id: string; dir: Dir } | null = null;
    if (lastNotify && lastNotify.atHistory === s.history.length) {
      setNotified((n) => n.slice(0, -1));
      back = { id: lastNotify.id, dir: "right" };
    } else if (s.history.length) {
      const id = s.history.at(-1)!;
      back = { id, dir: s.liked.includes(id) ? "right" : "left" };
      homelander.undo();
    }
    if (!back) return;
    setAnnounce(`Brought back ${unitById[back.id]?.name}.`);
    setAskReasonFor(null);
    setDetailsFor(null);
    // Only fly it back in if it will be the top card (the filter might hide it).
    if (matchesFilter(back.id, filter)) stack.current?.returnFrom(back.dir);
  }

  const canUndo = s.history.length > 0 || notified.length > 0;

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      decide("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      decide("right");
    } else if (e.key === "ArrowUp" && top && !open) {
      e.preventDefault();
      setDetailsFor(top.id);
    } else if ((e.key === "ArrowDown" || e.key === "Escape") && open) {
      // Leave ArrowDown alone when it's scrolling the details sheet... unless it's at the top.
      if (e.key === "ArrowDown" && el?.closest("[data-no-drag]")) return;
      e.preventDefault();
      setDetailsFor(null);
    } else if (e.key === "Backspace" && canUndo) {
      undo();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const closeDetails = useCallback(() => setDetailsFor(null), []);
  const openDetails = useCallback((id: string) => setDetailsFor(id), []);
  const asked = askReasonFor ? s.passed.find((p) => p.id === askReasonFor) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 overflow-x-clip [overflow-clip-margin:8px]">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="grid gap-1.5">
          <h1 className="font-pixel text-3xl leading-none sm:text-4xl">Find your home</h1>
          <p className="max-w-xl text-[15px] text-ink">
            {s.onboardedAt
              ? `Uncle's picks for you, best match first. Like up to ${DECK_LIKE_LIMIT}, then make them battle.`
              : "Every card is a real Gamuda Land home. Suka or tak nak?"}
          </p>
          {s.onboardedAt ? null : (
            <p className="text-sm text-ink-soft">
              <Link href="/onboarding" className="font-semibold text-pandan-deep underline underline-offset-4">
                Sit with Uncle first
              </Link>{" "}
              and the deck sorts itself to your life and budget.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PixTag tone="white" className="text-[12px]">
            <Sprite art="heart" scale={1.5} className="text-raya" />
            <span className="tabular-nums">
              {s.liked.length}/{DECK_LIKE_LIMIT}
            </span>
            <span className="sr-only"> liked</span>
          </PixTag>
          <PixPanel flat className="px-3 py-1.5 font-pixel text-base leading-none tabular-nums">
            {Math.min(position, units.length)} / {units.length}
            <span className="sr-only"> homes</span>
          </PixPanel>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,370px)] lg:gap-10">
        <section aria-label="Swipe deck" className="grid content-start gap-4 lg:row-span-3 lg:row-start-1">
          <div className="mx-auto grid w-full max-w-[460px] select-none">
            <p className="sr-only" aria-live="polite">
              {announce}
            </p>

            {top ? (
              <CardStack
                ref={stack}
                cards={queue.slice(0, 3)}
                dragDisabled={open}
                yesLabel={(u) => (availabilityOf(u.id).status === "Sold out" ? "PING ME" : "SUKA!")}
                label={(u) =>
                  `${townshipById[u.townshipId]?.name}, ${u.product ?? u.name}, ${rm(u.priceRM)}, ${pickById.get(u.id)?.score ?? "?"}% match, ${availabilityOf(u.id).status}`
                }
                onRelease={onRelease}
                onDone={onDone}
                onTap={() => setDetailsFor(top.id)}
                renderCard={(u, isTop) => (
                  <EncounterCard
                    unit={u}
                    pick={pickById.get(u.id)}
                    profile={s.profile}
                    basis={basis}
                    anchor={anchor}
                    isTop={isTop}
                    open={isTop && open}
                    onOpen={openDetails}
                    onClose={closeDetails}
                  />
                )}
              />
            ) : (
              <div className="h-[clamp(360px,calc(100svh-26rem),560px)] lg:h-[clamp(440px,64svh,640px)]">
                <EndOfDeck
                  s={s}
                  full={full}
                  rankedLikes={likedByMatch}
                  filtered={!full && unseen.length > 0}
                  onShowAll={() => setFilter("all")}
                />
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-5 p-1 pb-2">
              <RoundButton tone="raya" label="Pass on this home (left arrow)" disabled={!top} onClick={() => decide("left")}>
                <Sprite art="cross" scale={4} />
              </RoundButton>
              <RoundButton tone="white" small label="Undo last swipe (Backspace)" disabled={!canUndo} onClick={undo}>
                <Sprite art="undo" scale={3} />
              </RoundButton>
              {topSold ? (
                <RoundButton tone="kaya" label="Notify me if a unit frees up (right arrow)" onClick={() => decide("right")}>
                  <Sprite art={swipeSprites.bell} scale={4} />
                </RoundButton>
              ) : (
                <RoundButton tone="pandan" label="Like this home (right arrow)" disabled={!top} onClick={() => decide("right")}>
                  <Sprite art="heart" scale={4} className="text-white" />
                </RoundButton>
              )}
            </div>
            <p className="mt-3 hidden text-center text-xs text-ink-soft lg:block">
              Drag or flick the card. <Kbd>&larr;</Kbd> tak nak, <Kbd>&rarr;</Kbd> suka, <Kbd>&uarr;</Kbd> details,{" "}
              <Kbd>Backspace</Kbd> undo.
            </p>

            <div className="mt-4 min-h-[4.5rem]">{asked ? <ReasonPicker id={asked.id} picked={asked.reason} /> : null}</div>
          </div>
        </section>

        <div className="lg:col-start-2 lg:row-start-1">
          <Controls
            filter={filter}
            onFilter={setFilter}
            counts={counts}
            anchorId={s.anchorId}
            secondAnchorId={s.secondAnchorId}
            fromUncle={uncleAnchor && s.profile.workArea ? { anchor: uncleAnchor, said: s.profile.workArea } : null}
          />
        </div>
        <div className="lg:col-start-2 lg:row-start-2">
          <Shortlist liked={likedByMatch} scoreOf={(id) => pickById.get(id)?.score} />
        </div>
        <div className="lg:col-start-2 lg:row-start-3">
          <Insights s={s} />
        </div>
      </div>
    </div>
  );
}

/** Big round action button, like a dating app's, in the enamel-pill style. */
function RoundButton({
  tone,
  small,
  label,
  disabled,
  onClick,
  children,
}: {
  tone: "raya" | "pandan" | "kaya" | "white";
  small?: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <PixButton
      type="button"
      tone={tone}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={small ? "size-14 shrink-0 px-0" : "size-[4.5rem] shrink-0 px-0"}
    >
      {children}
    </PixButton>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border-2 border-ink bg-white px-1 font-pixel-label text-[10px] text-ink">{children}</kbd>;
}

function ReasonPicker({ id, picked }: { id: string; picked?: string }) {
  const unit = unitById[id];
  if (!unit) return null;
  const name = townshipById[unit.townshipId]?.name ?? unit.name;
  return (
    <PixPanel flat className="grid animate-in gap-3 p-3 duration-200 fade-in-0 slide-in-from-top-1 motion-reduce:animate-none">
      <p className="text-sm">
        <span className="font-semibold">Why tak nak {name}?</span>{" "}
        <span className="text-ink-soft">Optional. It teaches HomeLander your taste.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {passReasons.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={picked === r}
            onClick={() => homelander.reason(id, r)}
            className={
              picked === r
                ? "rounded-full border-2 border-ink bg-kaya px-3 py-1.5 text-sm font-semibold text-ink"
                : "rounded-full border-2 border-ink bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:bg-cloud"
            }
          >
            {r}
          </button>
        ))}
        {picked ? (
          <PixTag tone="pandan" className="self-center">
            Noted
          </PixTag>
        ) : null}
      </div>
    </PixPanel>
  );
}
