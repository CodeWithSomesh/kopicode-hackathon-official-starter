"use client";

import { UnitPhoto } from "@/components/homelander/unit-photo";
import { PixButton, PixMeter, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { rm } from "@/lib/homelander/data";
import { STATS, type Fighter, type StatKey } from "@/lib/homelander/analysis";
import { cn } from "@/lib/utils";
import { crown, UnitSelect, useStepIn } from "./bits";

const tones: Record<StatKey, "pandan" | "raya" | "kaya" | "lilac" | "sky"> = {
  commute: "sky",
  space: "lilac",
  wallet: "pandan",
  value: "kaya",
  ready: "sky",
  scarcity: "raya",
};

function raw(f: Fighter, key: StatKey) {
  switch (key) {
    case "commute":
      return `${f.weekHours.toFixed(1)} h/wk by ${f.usedMode}`;
    case "space":
      return `${f.unit.beds} bed, ${f.unit.builtUpSqft.toLocaleString("en-MY")} sqft`;
    case "wallet":
      return f.leftoverRM < 0 ? `${rm(f.leftoverRM)}/mo short` : `${rm(f.leftoverRM)} left/mo`;
    case "value":
      return `RM${Math.round(f.psf)}/sqft`;
    case "ready":
      return f.waitYears === 0 ? `Keys ${f.unit.completion}` : `${f.unit.completion}, ${f.waitYears} yr wait`;
    case "scarcity":
      return f.availability.left === 0 ? "Sold out" : `${f.availability.left} of ${f.availability.total} left`;
  }
}

export function FighterCard({
  fighter: f,
  slot,
  isWinner,
  winnerId,
  lineup,
  onSwap,
  onRemove,
}: {
  fighter: Fighter;
  slot: number;
  isWinner: boolean;
  winnerId: string;
  lineup: string[];
  onSwap: (id: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="relative pt-7">
      {isWinner ? (
        <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2 animate-[pix-bob_0.8s_steps(2)_infinite]">
          <Sprite art={crown} scale={4} className="text-kaya-deep" label="Winner" />
        </div>
      ) : null}
      <PixPanel
        className={cn("flex h-full flex-col gap-4 p-4", isWinner && "outline-4 outline-offset-[7px] outline-kaya")}
        aria-label={`Fighter ${slot + 1}: ${f.unit.name}`}
        role="group"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-lg leading-none text-ink-soft">P{slot + 1}</span>
          <UnitSelect
            value={f.unit.id}
            taken={lineup}
            onChange={onSwap}
            label={`Swap fighter ${slot + 1}`}
            className="min-w-0 flex-1"
          />
          {onRemove ? (
            <PixButton size="sm" className="size-9 shrink-0 px-0" onClick={onRemove} aria-label={`Remove ${f.unit.name}`}>
              <Sprite art="cross" scale={2} className="text-raya" />
            </PixButton>
          ) : null}
        </div>
        <FighterBody key={`${f.unit.id}:${winnerId}`} f={f} isWinner={isWinner} />
      </PixPanel>
    </div>
  );
}

/** Remounts when the fighter or the winner changes, so the HP bars refill block by block. */
function FighterBody({ f, isWinner }: { f: Fighter; isWinner: boolean }) {
  const p = useStepIn();
  const status = f.availability.status;

  return (
    <>
      <div className="relative">
        <UnitPhoto
          photo={f.unit.photo}
          alt={f.unit.photoAlt}
          width={480}
          height={300}
          className={cn("pix-img aspect-[16/10] w-full border-[3px] border-ink object-cover", !isWinner && "saturate-[0.85]")}
        />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {isWinner ? (
            <PixTag tone="kaya" className="animate-[pix-blink_0.35s_steps(1)_4]">
              Winner
            </PixTag>
          ) : (
            <PixTag tone="white">Rank {f.rank}</PixTag>
          )}
          <PixTag tone={status === "Available" ? "pandan" : status === "Sold out" ? "ink" : "raya"}>{status}</PixTag>
        </div>
      </div>

      <div className="grid gap-1">
        <h3 className="font-pixel text-xl leading-tight font-semibold">{f.unit.name}</h3>
        <p className="text-sm text-ink-soft">
          {f.township.name}, {f.township.area.split(",")[0]} · {f.unit.type} · {f.unit.tenure}
        </p>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-pixel text-2xl leading-none tabular-nums">{rm(f.priceRM)}</p>
          <p className="mt-1 text-sm text-ink-soft tabular-nums">
            {rm(Math.round(f.instalmentRM))}/mo instalment
          </p>
        </div>
        <div className="text-right">
          <p className="font-pixel text-3xl leading-none tabular-nums">{Math.round(f.overall * p)}</p>
          <p className="font-pixel-label text-[10px] uppercase">Overall</p>
        </div>
      </div>

      <ul className="grid gap-2.5">
        {STATS.map((s) => (
          <li key={s.key} className="grid grid-cols-[4.75rem_1fr] items-center gap-x-3 gap-y-1" title={s.hint}>
            <span className="font-pixel-label text-[11px] uppercase">{s.label}</span>
            <PixMeter
              value={Math.min(f.stats[s.key], p * 100)}
              tone={s.key === "wallet" && f.overBudget ? "raya" : tones[s.key]}
              label={`${s.label} ${f.stats[s.key]} out of 100`}
            />
            <span className="col-start-2 flex justify-between gap-2 text-xs text-ink-soft tabular-nums">
              <span>{raw(f, s.key)}</span>
              <span className="font-pixel text-sm text-ink">{f.stats[s.key]}</span>
            </span>
          </li>
        ))}
      </ul>

      {f.unit.highlights.length ? (
        <ul className="mt-auto grid gap-1.5 border-t-[3px] border-dotted border-ink/30 pt-3 text-sm">
          {f.unit.highlights.map((h) => (
            <li key={h} className="flex items-start gap-2">
              <Sprite art="sparkle" scale={2} className="mt-1 shrink-0 text-kaya-deep" />
              {h}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
