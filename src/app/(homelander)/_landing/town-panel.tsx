"use client";

import { UnitPhoto } from "@/components/homelander/unit-photo";
import Link from "next/link";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import {
  availabilityOf,
  driveMinutes,
  rm,
  rmShort,
  transitMinutes,
  type Anchor,
  type Availability,
} from "@/lib/homelander/data";
import { homelander, useHomeLander } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";
import { mapSprites, type TownInfo } from "./map-data";

const statusTone: Record<Availability["status"], "pandan" | "kaya" | "raya" | "ink"> = {
  Available: "pandan",
  "Few left": "kaya",
  "Last unit": "raya",
  "Sold out": "ink",
};

// Ink on the light pandan / white on raya fall under 4.5:1; the deep fills with white text pass (6.3 / 6.5).
const DEEP_PANDAN = "bg-pandan-deep text-white";
const DEEP: Partial<Record<Availability["status"], string>> = { Available: DEEP_PANDAN, "Last unit": "bg-raya-deep text-white" };

/**
 * The township's units: bottom sheet on phones (above the tab bar), side panel on desktop.
 */
export function TownPanel({ info, anchor, onClose, illustrative }: { info: TownInfo; anchor: Anchor; onClose: () => void; illustrative?: boolean }) {
  const s = useHomeLander();
  const { t } = info;
  const done = t.status === "completed";
  const drive = driveMinutes(t.pos, anchor.pos);
  const train = transitMinutes(t.pos, anchor.pos);

  return (
    <PixPanel
      role="dialog"
      data-obstacle
      aria-modal={false}
      aria-labelledby="town-panel-title"
      className={cn(
        "pointer-events-auto absolute z-20 flex flex-col",
        // phones: bottom sheet sitting above the tab bar
        "inset-x-3 bottom-[132px] max-h-[min(52svh,460px)]",
        // desktop: right side panel under the header
        "lg:inset-x-auto lg:top-[92px] lg:right-6 lg:bottom-12 lg:max-h-none lg:w-[380px]",
      )}
    >
      <div className="flex items-start gap-3 border-b-[3px] border-ink p-3">
        <Sprite art="house" scale={3} className="mt-0.5 shrink-0 text-pandan-deep" />
        <div className="min-w-0 flex-1">
          <h2 id="town-panel-title" className="font-pixel text-xl leading-tight font-bold">
            {t.name}
          </h2>
          <p className="text-sm text-ink-soft">{t.area}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <PixTag tone="kaya">From {rmShort(info.from)}</PixTag>
            {done ? (
              <PixTag tone="ink">Completed, resale only</PixTag>
            ) : (
              <PixTag tone={info.left ? "pandan" : "ink"} className={info.left ? DEEP_PANDAN : undefined}>{info.left} left</PixTag>
            )}
            <PixTag>Sample</PixTag>
          </div>
        </div>
        <PixButton size="sm" className="size-9 shrink-0 px-0" onClick={onClose} aria-label="Close township panel">
          <Sprite art="cross" scale={2} />
        </PixButton>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b-[3px] border-ink px-3 py-2">
        <PixButton asChild size="sm" tone="raya" className="text-white" style={{ "--pix-fill": "var(--color-raya-deep)" } as React.CSSProperties}>
          <Link href="/login">Start with Uncle</Link>
        </PixButton>
        {illustrative && (
          <span className="text-xs text-ink-soft">
            The glass block on the map is an illustrative block at Gamuda Cove (made-up units and prices). Tap a block to open it up.
          </span>
        )}
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b-[3px] border-ink bg-cloud px-3 py-2 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Sprite art={mapSprites.car} scale={2} className="text-ink" />
          <span className="font-pixel tabular-nums">{drive} min</span> drive
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Sprite art={mapSprites.train} scale={2} className="text-ink" />
          <span className="font-pixel tabular-nums">{train.minutes} min</span> train
        </span>
        <span className="text-ink-soft">to {anchor.name}, rush hour (estimate)</span>
      </p>

      <ul className="grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain p-3 pb-4">
        {info.units.map((u) => {
          const av = availabilityOf(u.id);
          const liked = s.liked.includes(u.id);
          const inBattle = s.compare.includes(u.id);
          const battleFull = !inBattle && s.compare.length >= 3;
          return (
            <li key={u.id} className="grid gap-2.5 border-[3px] border-ink bg-white p-2.5">
              <div className="flex gap-3">
                <UnitPhoto
                  photo={u.photo}
                  unoptimized
                  alt={u.photoAlt}
                  width={112}
                  height={84}
                  loading="lazy"
                  className="pix-img h-[84px] w-[112px] shrink-0 border-[3px] border-ink bg-sky object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-pixel text-base leading-tight font-bold">{u.name}</h3>
                  <p className="font-pixel text-lg leading-tight tabular-nums">{rm(u.priceRM)}</p>
                  <p className="text-xs text-ink-soft">
                    {u.type}, {u.beds} bed, {u.builtUpSqft.toLocaleString("en-MY")} sqft
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <PixTag tone={statusTone[av.status]} className={DEEP[av.status]}>{av.status}</PixTag>
                    <PixTag>
                      {av.left}/{av.total} {av.phase}
                    </PixTag>
                  </div>
                </div>
              </div>
              <p className="text-xs text-ink-soft">
                {drive} min drive or {train.minutes} min by train via {train.station} to {anchor.name}.
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1 pb-1.5">
                <PixButton
                  size="sm"
                  tone={liked ? "raya" : "white"}
                  aria-pressed={liked}
                  onClick={() => (liked ? homelander.unlike(u.id) : homelander.like(u.id))}
                >
                  <Sprite art="heart" scale={2} className={liked ? "text-white" : "text-raya"} />
                  {liked ? "Liked" : "Like"}
                </PixButton>
                <PixButton
                  size="sm"
                  tone={inBattle ? "kaya" : "white"}
                  aria-pressed={inBattle}
                  disabled={battleFull}
                  title={battleFull ? "The battle holds 3 homes. Remove one first." : undefined}
                  onClick={() =>
                    homelander.setCompare(inBattle ? s.compare.filter((x) => x !== u.id) : [...s.compare, u.id])
                  }
                >
                  <Sprite art="bars" scale={2} />
                  {inBattle ? "In battle" : battleFull ? "Battle full" : "Add to battle"}
                </PixButton>
                <PixButton asChild size="sm" tone="lilac">
                  <Link href={`/homes/${u.id}/feng-shui`}>Feng Shui</Link>
                </PixButton>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t-[3px] border-ink p-3">
        <span className="text-xs text-ink-soft">Battle: {s.compare.length}/3 homes</span>
        <PixButton asChild size="sm" tone="pandan" className="text-white" style={{ "--pix-fill": "var(--color-pandan-deep)" } as React.CSSProperties}>
          <Link href="/swipe">See in deck</Link>
        </PixButton>
      </div>
    </PixPanel>
  );
}
