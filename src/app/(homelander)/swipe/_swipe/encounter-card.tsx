"use client";

import { memo, useMemo } from "react";
import { UnitPhoto } from "@/components/homelander/unit-photo";
import { PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { availabilityOf, rm, townshipById, type Anchor, type Unit } from "@/lib/homelander/data";
import type { Profile } from "@/lib/homelander/profile";
import type { Pick as Match } from "@/lib/homelander/recommend";
import { cn } from "@/lib/utils";
import { homeDetails, type MoneyBasis } from "./buyer";
import { CardDetails } from "./details";
import { statusTone, stockLabel } from "./stock";
import { swipeSprites } from "./sprites";

export const fitTag: Record<Match["fit"], { tone: "pandan" | "kaya" | "raya"; label: string } | null> = {
  in: { tone: "pandan", label: "In budget" },
  stretch: { tone: "kaya", label: "Stretch" },
  over: { tone: "raya", label: "Over budget" },
  unknown: null,
};

type Props = {
  unit: Unit;
  pick?: Match;
  profile: Profile;
  /** Null until the buyer gives a salary or runs the bank check. */
  basis: MoneyBasis | null;
  /** Null until we know where the buyer works. */
  anchor: Anchor | null;
  /** Only the top card loads its photo eagerly and can open its details. */
  isTop: boolean;
  open: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
};

/**
 * One home as a dating-app card: an edge-to-edge photo, the essentials over a scrim at the
 * bottom, and a "More details" sheet with every number worked out for this buyer.
 */
export const EncounterCard = memo(function EncounterCard({ unit, pick, profile, basis, anchor, isTop, open, onOpen, onClose }: Props) {
  const t = townshipById[unit.townshipId]!;
  const a = availabilityOf(unit.id);
  const sold = a.status === "Sold out";
  const fit = pick ? fitTag[pick.fit] : null;
  const psf = Math.round(unit.priceRM / unit.builtUpSqft);
  const d = useMemo(() => (open ? homeDetails(unit, profile, basis, anchor) : null), [open, unit, profile, basis, anchor]);
  const lead = pick?.reasons[0] ?? unit.highlights[0];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit] bg-ink text-white">
      <UnitPhoto
        photo={unit.photo}
        alt={unit.photoAlt}
        fill
        unoptimized
        draggable={false}
        priority={isTop}
        sizes="(min-width: 1024px) 460px, 100vw"
        className={cn("pix-img pointer-events-none object-cover", sold && "grayscale-[0.75]")}
      />

      {/* Top row: stock and match. */}
      <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        <PixTag tone={statusTone[a.status]} className="shadow-[0_2px_8px_rgb(0_0_0/0.25)]">
          {stockLabel(a)}
          {sold ? null : <span className="opacity-70">· sample</span>}
        </PixTag>
        {pick ? (
          <div
            className="grid place-items-center rounded-full border-2 border-ink bg-white px-3 py-1.5 text-ink shadow-[0_2px_10px_rgb(0_0_0/0.25)]"
            aria-label={`${pick.score}% match`}
          >
            <span className="font-pixel text-xl leading-none tabular-nums">{pick.score}%</span>
            <span className="font-pixel-label text-[9px] leading-none uppercase">match</span>
          </div>
        ) : null}
      </div>

      {sold ? (
        <div className="absolute inset-x-0 top-[34%] grid place-items-center">
          <span className="-rotate-12 rounded-lg border-4 border-white bg-raya px-4 py-2 font-pixel text-4xl leading-none tracking-wider text-white shadow-[0_6px_0_0_var(--color-ink)]">
            SOLD OUT
          </span>
        </div>
      ) : null}

      {/* The essentials, on a scrim so they read over any photo. */}
      <div className="absolute inset-x-0 bottom-0 grid gap-2 bg-linear-to-t from-ink/95 via-ink/70 to-transparent px-4 pt-24 pb-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {fit ? <PixTag tone={fit.tone}>{fit.label}</PixTag> : null}
          <PixTag tone="white">{unit.type}</PixTag>
          {unit.completion > 2026 ? <PixTag tone="lilac">Ready {unit.completion}</PixTag> : null}
        </div>
        <div className="grid gap-0.5">
          <h2 className="font-pixel text-[1.9rem] leading-[1.05] text-balance sm:text-[2.1rem]">{t.name}</h2>
          <p className="truncate text-[15px] text-white/85">
            {unit.product ?? unit.name} · {t.area}
          </p>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <p className="font-pixel text-[1.65rem] leading-none tabular-nums">{rm(unit.priceRM)}</p>
          <p className="text-sm text-white/80 tabular-nums">RM{psf.toLocaleString("en-MY")} psf</p>
        </div>
        <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-sm text-white/90 tabular-nums">
          <Fact art={swipeSprites.bed}>{unit.beds} bed</Fact>
          <Fact art={swipeSprites.bath}>{unit.baths} bath</Fact>
          <Fact art={swipeSprites.area}>{unit.builtUpSqft.toLocaleString("en-MY")} sq ft</Fact>
          <li>{unit.tenure}</li>
        </ul>
        <div className="mt-1 flex items-center justify-between gap-4 border-t border-white/15 pt-3">
          {lead ? (
            <p className="flex min-w-0 flex-1 items-start gap-2 text-sm leading-snug text-white/90">
              <Sprite art="sparkle" scale={2} className="mt-0.5 shrink-0 text-kaya" />
              <span className="line-clamp-2 min-w-0">{lead}</span>
            </p>
          ) : (
            <span />
          )}
          {isTop ? (
            <button
              type="button"
              onClick={() => onOpen(unit.id)}
              aria-expanded={open}
              aria-label="More details (up arrow)"
              className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-[0_2px_0_0_var(--color-ink)] transition-transform hover:-translate-y-px active:translate-y-px"
            >
              <Sprite art={swipeSprites.up} scale={2} />
              More details
            </button>
          ) : null}
        </div>
      </div>

      {open && d ? (
        <div
          data-no-drag
          role="region"
          aria-label={`Details for ${t.name}`}
          className="absolute inset-0 animate-in overflow-y-auto overscroll-contain bg-white text-ink duration-300 fade-in-0 slide-in-from-bottom-8 motion-reduce:animate-none"
        >
          <CardDetails unit={unit} pick={pick} d={d} basis={basis} onClose={onClose} />
        </div>
      ) : null}
    </div>
  );
});

function Fact({ art, children }: { art: (typeof swipeSprites)[keyof typeof swipeSprites]; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <Sprite art={art} scale={2} className="shrink-0 text-white/80" />
      {children}
    </li>
  );
}
