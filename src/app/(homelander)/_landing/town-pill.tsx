"use client";

import { Sprite } from "@/components/homelander/sprite";
import { rmShort } from "@/lib/homelander/data";
import { cn } from "@/lib/utils";
import { mapSprites, pillLean, type TownInfo } from "./map-data";

/** The township pill on the map: house sprite, name, "From RM...", units left. */
export function TownPill({ info, selected, onPick }: { info: TownInfo; selected: boolean; onPick: () => void }) {
  const lean = pillLean[info.t.id] ?? "center";
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPick();
        }}
        aria-pressed={selected}
        aria-label={`${info.t.name}, from ${rmShort(info.from)}, ${info.left} units left`}
        className="pix-frame flex cursor-pointer items-center gap-2 px-2 py-1.5 whitespace-nowrap text-ink"
        style={
          {
            "--pix-fill": selected ? "var(--color-kaya)" : "var(--j-surface, #ffffff)",
            "--pix-drop": "4px",
          } as React.CSSProperties
        }
      >
        <Sprite art="house" scale={2} className={info.left ? "text-pandan-deep" : "text-ink-soft"} />
        <span className="grid gap-1 text-left">
          <span className="font-pixel text-sm leading-none font-bold">{info.t.name}</span>
          <span className="flex items-center gap-1.5">
            <span className="font-pixel text-xs leading-none tabular-nums">From {rmShort(info.from)}</span>
            <span
              className={cn(
                "px-1 py-px font-pixel-label text-[9px] leading-none uppercase",
                info.left ? "bg-pandan text-ink" : "bg-ink text-white",
              )}
            >
              {info.left ? `${info.left} left` : "Sold out"}
            </span>
          </span>
        </span>
      </button>
      <Sprite
        art={mapSprites.tail}
        scale={2}
        className={cn("mt-[3px] text-ink", lean === "left" ? "self-end" : lean === "right" ? "self-start" : "self-center")}
      />
    </div>
  );
}

/** Where the buyer works (from the deck's work anchor). */
export function WorkMarker({ name }: { name: string }) {
  return (
    <div className="pointer-events-none flex flex-col items-center" aria-label={`Your work: ${name}`} role="img">
      <div
        className="pix-frame flex items-center gap-1.5 px-1.5 py-1"
        style={{ "--pix-fill": "var(--color-lilac)", "--pix-drop": "3px" } as React.CSSProperties}
      >
        <Sprite art={mapSprites.office} scale={2} className="text-ink" />
        <span className="font-pixel-label text-[9px] leading-none uppercase">Work</span>
      </div>
      <Sprite art={mapSprites.tail} scale={2} className="mt-[3px] text-ink" />
    </div>
  );
}
