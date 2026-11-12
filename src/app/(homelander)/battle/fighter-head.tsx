"use client";

import { UnitPhoto } from "@/components/homelander/unit-photo";
import { PixButton, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import type { Fighter } from "@/lib/homelander/battle-verdict";
import { cn } from "@/lib/utils";
import { crown, money, UnitSelect } from "./bits";
import { fitTone } from "./rows";

const fitShort = {
  in: "In budget",
  stretch: "Stretch",
  over: "Over",
  unknown: null,
} as const;

/**
 * Compact column header: photo, name, project, price, match, fit, swap and remove. The rank and
 * the winner's crown only show once the fight has been played (`revealed`).
 */
export function FighterHead({
  f,
  slot,
  isWinner,
  revealed,
  lineup,
  onSwap,
  onRemove,
}: {
  f: Fighter;
  slot: number;
  isWinner: boolean;
  revealed: boolean;
  lineup: string[];
  onSwap: (id: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="grid gap-2 text-left font-normal">
      <div className="relative">
        <UnitPhoto
          photo={f.unit.photo}
          alt={f.unit.photoAlt}
          width={320}
          height={200}
          className={cn(
            "pix-img aspect-[16/10] w-full rounded-lg border-2 border-ink object-cover",
            f.soldOut && "grayscale",
          )}
        />
        <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
          {!revealed ? null : isWinner ? (
            <PixTag tone="kaya">
              <Sprite art={crown} scale={1.5} className="text-ink" />
              Winner
            </PixTag>
          ) : (
            <PixTag tone="white">#{f.rank}</PixTag>
          )}
          {f.soldOut ? <PixTag tone="ink">Sold out</PixTag> : null}
        </div>
        <span className="absolute right-1.5 bottom-1.5 rounded-full bg-ink px-1.5 py-0.5 font-pixel text-[11px] leading-none text-white">
          P{slot + 1}
        </span>
      </div>

      <div className="grid gap-0.5">
        <p className="line-clamp-2 min-h-[2.5em] font-pixel text-[15px] leading-tight">
          {f.unit.name}
        </p>
        <p
          className="truncate text-xs text-ink-soft"
          title={`${f.township.name}, ${f.township.area}`}
        >
          {f.township.name} · {f.township.area.split(",")[0]}
        </p>
      </div>

      <p className="font-pixel text-lg leading-none tabular-nums">
        {money(f.priceRM)}
      </p>

      <div className="flex flex-wrap gap-1">
        <PixTag tone="lilac" title="Match score from your swipe deck">
          Match {f.match}
        </PixTag>
        {fitShort[f.fit] ? (
          <PixTag tone={fitTone[f.fit]}>{fitShort[f.fit]}</PixTag>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 pt-0.5">
        <UnitSelect
          compact
          value={f.unit.id}
          taken={lineup}
          onChange={onSwap}
          label={`Swap ${f.unit.name} for another home`}
          className="min-w-0 flex-1"
        />
        {onRemove ? (
          <PixButton
            size="sm"
            className="size-9 shrink-0 px-0"
            onClick={onRemove}
            aria-label={`Remove ${f.unit.name}`}
          >
            <Sprite art="cross" scale={2} className="text-raya" />
          </PixButton>
        ) : null}
      </div>
    </div>
  );
}
