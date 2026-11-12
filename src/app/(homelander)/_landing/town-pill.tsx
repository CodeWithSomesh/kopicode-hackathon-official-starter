"use client";

import { Sprite } from "@/components/homelander/sprite";
import { rmShort } from "@/lib/homelander/data";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import { mapSprites, type TownInfo } from "./map-data";

/** The township pill on the map: house sprite, name, "From RM...", units left. */
export function TownPill({
  info,
  lean,
  selected,
  onPick,
}: {
  info: TownInfo;
  lean: "left" | "right" | "center" | "below";
  selected: boolean;
  onPick: () => void;
}) {
  const t = useT();
  const done = info.t.status === "completed";
  const short = info.t.name.replace(/^(The|Bandar|Kota) /, "").replace(/ (Mansions|Suites)$/, "");
  return (
    <div className={cn("group flex", lean === "below" ? "flex-col-reverse" : "flex-col", done && "hover:z-10")}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPick();
        }}
        aria-pressed={selected}
        aria-label={done ? t("{name}, completed, resale only", { name: info.t.name }) : t("{name}, from {price}, {n} units left", { name: info.t.name, price: rmShort(info.from), n: info.left })}
        className={cn(
          "pix-frame flex cursor-pointer items-center gap-2 px-2 py-1.5 whitespace-nowrap text-ink max-lg:gap-1 max-lg:px-1.5 max-lg:py-1",
          done && "gap-1 px-1.5 py-1 text-ink-soft max-lg:px-1 max-lg:py-0.5",
        )}
        style={
          {
            "--pix-fill": selected ? "var(--color-kaya)" : done ? "var(--color-cloud)" : "var(--j-surface, #ffffff)",
            "--pix-drop": "4px",
          } as React.CSSProperties
        }
      >
        <Sprite art="house" scale={done ? 1 : 2} className={cn(done ? "opacity-60" : "max-lg:hidden", done || !info.left ? "text-ink-soft" : "text-pandan-deep")} />
        <span className="grid gap-1 text-left">
          <span className={cn("font-pixel text-sm leading-none font-bold max-lg:text-xs", done && "text-xs max-lg:text-[10px]")}>
            {done ? (
              <>
                <span className="group-hover:hidden group-focus-within:hidden">{short}</span>
                <span className="hidden group-hover:inline group-focus-within:inline">{info.t.name}</span>
              </>
            ) : (
              info.t.name
            )}
          </span>
          <span className={cn("items-center gap-1.5", done ? "hidden group-hover:flex group-focus-within:flex" : "flex")}>
            <span className="font-pixel text-xs leading-none tabular-nums max-lg:hidden">From {rmShort(info.from)}</span>
            <span
              className={cn(
                "px-1 py-px font-pixel-label text-[11px] leading-none uppercase",
                done ? "bg-ink-soft text-white" : info.left ? "bg-pandan-deep text-white" : "bg-ink text-white",
              )}
            >
              {done ? t("Completed, resale only") : info.left ? t("{n} left", { n: info.left }) : t("Sold out")}
            </span>
          </span>
        </span>
      </button>
      <Sprite
        art={mapSprites.tail}
        scale={2}
        className={cn(lean === "below" ? "mb-[3px] rotate-180" : "mt-[3px]", "text-ink", lean === "left" ? "self-end" : lean === "right" || lean === "below" ? "self-start" : "self-center")}
      />
    </div>
  );
}

/** Where the buyer works (from the deck's work anchor). */
export function WorkMarker({ name }: { name: string }) {
  const t = useT();
  return (
    <div className="pointer-events-none flex flex-col items-center" aria-label={t("Your work: {name}", { name })} role="img">
      <div
        className="pix-frame flex items-center gap-1.5 px-1.5 py-1"
        style={{ "--pix-fill": "var(--color-lilac)", "--pix-drop": "3px" } as React.CSSProperties}
      >
        <Sprite art={mapSprites.office} scale={2} className="text-ink" />
        <span className="font-pixel-label text-[11px] leading-none uppercase">{t("Work")}</span>
      </div>
      <Sprite art={mapSprites.tail} scale={2} className="mt-[3px] text-ink" />
    </div>
  );
}
