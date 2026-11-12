"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { anchorOptions, availabilityOf, passReasons, rm, unitById } from "@/lib/homelander/data";
import { DECK_LIKE_LIMIT, anchorFor, recommend } from "@/lib/homelander/recommend";
import { homelander, useHomeLander } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";
import { EncounterCard, THRESHOLD } from "./_swipe/encounter-card";
import { Controls, EndOfDeck, Insights, Shortlist, matchesFilter, type StockFilter } from "./_swipe/panels";
import { swipeSprites } from "./_swipe/sprites";

const LEAVE_MS = 240;

/**
 * The encounter deck: one Gamuda Land unit at a time with its availability up front.
 * Right = like (or "notify me" when sold out), left = pass then optionally say why.
 * Desktop: deck on the left, filters/insights/shortlist in a right column. Phones: one column.
 */
export function SwipeDeck() {
  const s = useHomeLander();
  const [filter, setFilter] = useState<StockFilter>("all");
  /** Sold-out units the buyer asked to be notified about, this visit only (nothing is stored). */
  const [notified, setNotified] = useState<{ id: string; atHistory: number }[]>([]);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [askReasonFor, setAskReasonFor] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const start = useRef(0);

  const anchor = anchorFor(s.profile.workArea) ?? anchorOptions.find((a) => a.id === s.anchorId) ?? anchorOptions[0]!;
  // Uncle's order: best match for this buyer first.
  const picks = useMemo(() => recommend(s.profile, s.budget, anchor), [s.profile, s.budget, anchor]);
  const pickById = useMemo(() => new Map(picks.map((p) => [p.unit.id, p])), [picks]);
  const units = picks.map((p) => p.unit);
  const likedByMatch = [...s.liked].sort((a, b) => (pickById.get(b)?.score ?? 0) - (pickById.get(a)?.score ?? 0));
  const full = s.liked.length >= DECK_LIKE_LIMIT;

  const seen = new Set([...s.history, ...notified.map((n) => n.id)]);
  const unseen = units.filter((u) => !seen.has(u.id));
  const queue = full ? [] : unseen.filter((u) => matchesFilter(u.id, filter));
  const top = queue[0];
  const next = queue[1];
  const topSold = top ? availabilityOf(top.id).status === "Sold out" : false;
  const counts = {
    all: unseen.length,
    available: unseen.filter((u) => matchesFilter(u.id, "available")).length,
    few: unseen.filter((u) => matchesFilter(u.id, "few")).length,
  };
  const position = units.length - unseen.length + 1;

  function commit(dir: "left" | "right", id: string) {
    const unit = unitById[id]!;
    const sold = availabilityOf(id).status === "Sold out";
    if (dir === "right" && sold) {
      setNotified((n) => [...n, { id, atHistory: s.history.length }]);
      setAskReasonFor(null);
      toast.success(`Okay, we'll ping you if a ${unit.name} frees up.`, {
        description: "Demo only: no alert is actually set.",
      });
      setAnnounce(`Notify me set for ${unit.name}.`);
    } else if (dir === "right") {
      homelander.like(id);
      setAskReasonFor(null);
      setAnnounce(`Liked ${unit.name}. Added to your shortlist.`);
    } else {
      homelander.pass(id);
      setAskReasonFor(id);
      setAnnounce(`Passed on ${unit.name}.`);
    }
    setLeaving(null);
    setDx(0);
  }

  function decide(dir: "left" | "right") {
    if (!top || leaving) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return commit(dir, top.id);
    setLeaving(dir);
    const id = top.id;
    window.setTimeout(() => commit(dir, id), LEAVE_MS);
  }

  function undo() {
    const lastNotify = notified.at(-1);
    if (lastNotify && lastNotify.atHistory === s.history.length) {
      setNotified((n) => n.slice(0, -1));
      setAnnounce(`Brought back ${unitById[lastNotify.id]?.name}.`);
    } else if (s.history.length) {
      const id = s.history.at(-1)!;
      homelander.undo();
      setAnnounce(`Brought back ${unitById[id]?.name}.`);
    }
    setAskReasonFor(null);
  }

  const canUndo = s.history.length > 0 || notified.length > 0;

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "SELECT" || el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      decide("left");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      decide("right");
    } else if (e.key === "Backspace" && canUndo) {
      undo();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const offset = leaving === "left" ? -760 : leaving === "right" ? 760 : dx;
  // Rotation snaps to 2-degree steps so the card tilts like a sprite.
  const tilt = Math.round(offset / 44) * 2;
  const asked = askReasonFor ? s.passed.find((p) => p.id === askReasonFor) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 overflow-x-clip [overflow-clip-margin:8px]">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="grid gap-1">
          <h1 className="font-pixel text-3xl leading-none font-bold sm:text-4xl">Find your home</h1>
          <p className="text-[15px] text-ink">
            {s.onboardedAt
              ? "Uncle's picks for you, best match first. Like up to 10, then make them battle."
              : "Every card is a Gamuda Land home type with sample prices and stock. Suka or tak nak?"}
          </p>
          {s.onboardedAt ? null : (
            <p className="text-sm text-ink-soft">
              <Link href="/onboarding" className="font-medium text-pandan-deep underline underline-offset-4">
                Sit with Uncle first
              </Link>{" "}
              and the deck sorts itself to your life and budget.
            </p>
          )}
        </div>
        <PixPanel flat className="px-2.5 py-1.5 font-pixel text-base leading-none tabular-nums">
          {Math.min(position, units.length)} / {units.length}
          <span className="sr-only"> homes</span>
        </PixPanel>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:gap-10">
        {/* Deck column. On lg it spans the right column's rows. */}
        <section aria-label="Encounter deck" className="grid content-start gap-5 lg:row-span-3 lg:row-start-1">
          <div className="mx-auto grid w-full max-w-[560px] select-none lg:max-w-[820px]">
            <p className="sr-only" aria-live="polite">
              {announce}
            </p>

            {top ? (
              <div className="grid p-1 pb-3 [&>*]:[grid-area:1/1]">
                {next ? (
                  <PixPanel aria-hidden className="translate-y-3 opacity-90" style={{ "--pix-drop": "0px" } as React.CSSProperties}>
                    <div className="h-full" />
                  </PixPanel>
                ) : null}
                <PixPanel
                  key={top.id}
                  asChild
                  className={cn(
                    "relative flex touch-pan-y flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
                    dragging ? "cursor-grabbing" : "cursor-grab",
                    !dragging &&
                      "transition-transform duration-200 ease-[steps(5)] motion-reduce:transition-none",
                  )}
                  style={{ transform: `translateX(${offset}px) rotate(${tilt}deg)` }}
                >
                  <article
                    aria-label={`${top.name}, ${rm(top.priceRM)}, ${availabilityOf(top.id).status}`}
                    onPointerDown={(e) => {
                      if (leaving) return;
                      start.current = e.clientX;
                      setDragging(true);
                      e.currentTarget.setPointerCapture?.(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (dragging) setDx(e.clientX - start.current);
                    }}
                    onPointerUp={() => {
                      if (!dragging) return;
                      setDragging(false);
                      if (dx > THRESHOLD) decide("right");
                      else if (dx < -THRESHOLD) decide("left");
                      else setDx(0);
                    }}
                    onPointerCancel={() => {
                      setDragging(false);
                      setDx(0);
                    }}
                  >
                    <EncounterCard unit={top} anchor={anchor} drag={offset} pick={pickById.get(top.id)} />
                  </article>
                </PixPanel>
              </div>
            ) : (
              <div className="p-1 pb-3">
                <EndOfDeck
                  s={s}
                  rankedLikes={likedByMatch}
                  filtered={!full && unseen.length > 0}
                  onShowAll={() => setFilter("all")}
                />
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-4 p-1 pb-2 sm:gap-6">
              <PixButton
                type="button"
                tone="raya"
                size="lg"
                className="min-w-[7.5rem] flex-1 sm:flex-none"
                disabled={!top}
                onClick={() => decide("left")}
                aria-label="Pass on this home (left arrow)"
              >
                <Sprite art="cross" scale={3} />
                Tak nak
              </PixButton>
              <PixButton
                type="button"
                size="lg"
                className="size-14 shrink-0 px-0"
                disabled={!canUndo}
                onClick={undo}
                aria-label="Undo last swipe"
              >
                <Sprite art="undo" scale={3} />
              </PixButton>
              {topSold ? (
                <PixButton
                  type="button"
                  tone="kaya"
                  size="lg"
                  className="min-w-[7.5rem] flex-1 sm:flex-none"
                  onClick={() => decide("right")}
                  aria-label="Notify me if a unit frees up (right arrow)"
                >
                  <Sprite art={swipeSprites.bell} scale={3} />
                  Notify me
                </PixButton>
              ) : (
                <PixButton
                  type="button"
                  tone="pandan"
                  size="lg"
                  className="min-w-[7.5rem] flex-1 sm:flex-none"
                  disabled={!top}
                  onClick={() => decide("right")}
                  aria-label="Like this home (right arrow)"
                >
                  <Sprite art="heart" scale={3} className="text-raya-deep" />
                  Suka!
                </PixButton>
              )}
            </div>
            <p className="mt-3 hidden text-center text-xs text-ink lg:block">
              Drag the card, or use <Kbd>&larr;</Kbd> <Kbd>&rarr;</Kbd> and <Kbd>Backspace</Kbd> to undo.
            </p>

            <div className="mt-4 min-h-[4.5rem]">
              {asked ? <ReasonPicker id={asked.id} picked={asked.reason} /> : null}
            </div>
          </div>
        </section>

        <div className="lg:col-start-2 lg:row-start-1">
          <Controls
            filter={filter}
            onFilter={setFilter}
            counts={counts}
            anchorId={s.anchorId}
            secondAnchorId={s.secondAnchorId}
          />
        </div>
        <div className="lg:col-start-2 lg:row-start-2">
          <Insights s={s} />
        </div>
        <div className="lg:col-start-2 lg:row-start-3">
          <Shortlist liked={likedByMatch} />
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="border-2 border-ink bg-white px-1 font-pixel-label text-[10px] text-ink">{children}</kbd>;
}

function ReasonPicker({ id, picked }: { id: string; picked?: string }) {
  const unit = unitById[id];
  if (!unit) return null;
  return (
    <PixPanel flat className="grid gap-3 p-3">
      <p className="text-sm">
        <span className="font-medium">Why tak nak {unit.name}?</span>{" "}
        <span className="text-ink-soft">Optional. It teaches HomeLander your taste.</span>
      </p>
      <div className="flex flex-wrap gap-3 p-1">
        {passReasons.map((r) => (
          <PixButton
            key={r}
            type="button"
            size="sm"
            tone={picked === r ? "kaya" : "white"}
            aria-pressed={picked === r}
            onClick={() => homelander.reason(id, r)}
          >
            {r}
          </PixButton>
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
