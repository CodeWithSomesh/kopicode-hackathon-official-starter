"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PixButton, PixMeter, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite, defineSprite } from "@/components/homelander/sprite";
import { rm, townshipById, type Unit } from "@/lib/homelander/data";
import { homelander, useHomeLander, type Answers } from "@/lib/homelander/store";
import { scoreShortlist, verdictReasons } from "@/lib/homelander/verdict";
import { cn } from "@/lib/utils";

const lock = defineSprite([".###.", "#...#", "#...#", "#####", "##.##", "##.##", "#####"]);

/** Uncle's verdict. Locked until all five questions are answered. */
export function VerdictPanel({
  list,
  answers,
  answeredCount,
  onBooked,
}: {
  list: Unit[];
  answers: Answers | null;
  answeredCount: number;
  onBooked: () => void;
}) {
  const s = useHomeLander();
  const [name, setName] = useState("");
  const [booking, setBooking] = useState(false);

  if (!answers) {
    return (
      <PixPanel tone="lilac" className="grid justify-items-start gap-3 p-5">
        <div className="flex items-center gap-3">
          <Sprite art={lock} scale={4} className="text-ink" />
          <h2 className="font-pixel text-2xl leading-none">Verdict locked</h2>
        </div>
        <p className="text-[15px] leading-snug">
          Answer all five and Uncle scores every home on commute, space and money, weighted by what you said
          matters. {answeredCount} of 5 done.
        </p>
      </PixPanel>
    );
  }

  const scored = scoreShortlist(list, answers, s.anchorId, Boolean(s.budget));
  const reasons = verdictReasons(scored);
  const winner = scored[0];
  if (!winner) return null;
  const town = townshipById[winner.unit.townshipId];

  function book(e: React.FormEvent) {
    e.preventDefault();
    if (!winner || !name.trim()) return;
    setBooking(true);
    const now = new Date();
    homelander.addLead({
      id: `uncle-${now.getTime()}`,
      name: name.trim(),
      unitId: winner.unit.id,
      maxPriceRM: s.budget?.maxPriceRM ?? 0,
      createdAt: now.toISOString(),
      reasons,
    });
    toast.success(`Viewing booked for ${winner.unit.name}`, {
      description: "Gamuda Land sales will call you to fix a time. (Demo: nobody is actually called.)",
    });
    onBooked();
  }

  return (
    <PixPanel className="grid gap-5 p-5">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sprite art="star" scale={3} className="text-kaya-deep" />
          <h2 className="font-pixel text-lg leading-none">Uncle&apos;s pick</h2>
          <PixTag tone="kaya">Sample data</PixTag>
        </div>
        <p className="font-pixel text-3xl leading-tight font-bold lg:text-4xl">{winner.unit.name}</p>
        <p className="text-sm text-ink-soft">
          {town?.name}, {town?.area} · {rm(winner.unit.priceRM)} · {winner.unit.beds} bedrooms
        </p>
      </div>

      <ul className="grid gap-2">
        {reasons.map((r) => (
          <li key={r} className="flex gap-2 text-[15px] leading-snug">
            <Sprite art="sparkle" scale={2} className="mt-1 shrink-0 text-pandan-deep" />
            {r}
          </li>
        ))}
      </ul>

      <div className="grid gap-3">
        <h3 className="font-pixel text-base leading-none">Fit score</h3>
        <ol className="grid gap-3">
          {scored.map((r, i) => (
            <li key={r.unit.id} className={cn("grid gap-1.5 p-2", i === 0 && "bg-kaya/30")}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{r.unit.name}</span>
                <span className="font-pixel text-xl leading-none tabular-nums">{r.total}</span>
              </div>
              <PixMeter value={r.total} tone={i === 0 ? "pandan" : "sky"} label={`${r.unit.name} fit score`} />
              <p className="text-xs text-ink-soft tabular-nums">
                Commute {r.commute} · Space {r.space} · Money {r.money}
                {r.overBudget ? " · over budget" : ""}
                {` · ${r.weeklyHours.toFixed(1)} h a week on the road`}
              </p>
            </li>
          ))}
        </ol>
        {!s.budget ? (
          <p className="text-xs text-ink-soft">
            Money counts as a neutral 60 until you{" "}
            <Link href="/bank" className="underline decoration-2 underline-offset-2">
              run the bank check
            </Link>
            .
          </p>
        ) : null}
      </div>

      <form onSubmit={book} className="grid gap-3 border-t-[3px] border-dashed border-ink/30 pt-4">
        <h3 className="font-pixel text-base leading-none">Like it? Go and see it.</h3>
        <label htmlFor="uncle-name" className="sr-only">
          Your name
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="uncle-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
            maxLength={60}
            className="h-11 min-w-0 flex-1 border-[3px] border-ink bg-white px-3 text-base outline-none placeholder:text-ink-soft/70 focus-visible:bg-cloud"
          />
          <PixButton type="submit" tone="raya" disabled={!name.trim() || booking}>
            <Sprite art="heart" scale={2} />
            Book a viewing
          </PixButton>
        </div>
        <p className="text-xs text-ink-soft">
          Sends your name, Uncle&apos;s pick and his reasons to Gamuda Land sales.
        </p>
      </form>
    </PixPanel>
  );
}
