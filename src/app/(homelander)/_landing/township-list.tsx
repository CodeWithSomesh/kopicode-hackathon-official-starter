"use client";

import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { railLines, rmShort } from "@/lib/homelander/data";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import { mapSprites, railColors, towns } from "./map-data";

/** Desktop: the township list on the left. Phones: township chips under the header. */
export function TownshipList({
  selected,
  onPick,
  onShowAll,
  anchorName,
}: {
  selected?: string;
  onPick: (id: string) => void;
  onShowAll: () => void;
  anchorName: string;
}) {
  const t = useT();
  return (
    <>
      <PixPanel data-obstacle className="absolute top-[92px] left-6 z-10 hidden max-h-[calc(100svh-140px)] w-72 flex-col lg:flex">
        <div className="grid gap-1.5 border-b-[3px] border-ink p-3">
          <h2 className="font-pixel text-xl leading-tight font-bold">{t("Gamuda Land map")}</h2>
          <p className="text-sm leading-snug text-ink-soft">
            {t("Townships around the Klang Valley. Pick one to see what's still up for grabs.")}
          </p>
          <div>
            <PixTag tone="kaya">{t("Sample data")}</PixTag>
          </div>
        </div>
        <ul className="grid min-h-0 flex-1 gap-1 overflow-y-auto p-2">
          <li>
            <button
              type="button"
              onClick={onShowAll}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-2 text-left font-pixel text-sm hover:bg-sky/40",
                !selected && "bg-cloud",
              )}
            >
              <Sprite art="pin" scale={2} className="text-ink-soft" />
              {t("Show all townships")}
            </button>
          </li>
          {towns.map((x) => (
            <li key={x.t.id}>
              <button
                type="button"
                onClick={() => onPick(x.t.id)}
                aria-pressed={selected === x.t.id}
                className={cn(
                  "flex w-full items-center gap-2.5 px-2 py-2 text-left transition-colors",
                  selected === x.t.id ? "bg-kaya" : "hover:bg-sky/40",
                )}
              >
                <Sprite art="house" scale={2} className={x.left ? "shrink-0 text-pandan-deep" : "shrink-0 text-ink-soft"} />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-pixel text-base leading-tight font-bold">{x.t.name}</span>
                  <span className={cn("truncate text-xs", selected === x.t.id ? "text-ink" : "text-ink-soft")}>{x.t.area}</span>
                </span>
                <span className="grid shrink-0 justify-items-end gap-0.5">
                  <span className="font-pixel text-sm leading-none tabular-nums">{rmShort(x.from)}</span>
                  <span className="font-pixel-label text-[11px] leading-none uppercase">{t("{n} left", { n: x.left })}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Legend anchorName={anchorName} />
      </PixPanel>

      <nav
        aria-label={t("Townships")}
        className="absolute inset-x-0 top-[68px] pointer-events-none z-10 flex gap-3 overflow-x-auto px-4 pt-2 pb-4 [scrollbar-width:none] lg:hidden"
      >
        <PixButton size="sm" className="pointer-events-auto shrink-0" onClick={onShowAll} tone={selected ? "white" : "kaya"}>
          {t("All")}
        </PixButton>
        {towns.map((x) => (
          <PixButton
            key={x.t.id}
            size="sm"
            className="pointer-events-auto shrink-0 whitespace-nowrap"
            tone={selected === x.t.id ? "kaya" : "white"}
            aria-pressed={selected === x.t.id}
            onClick={() => onPick(x.t.id)}
          >
            {x.t.name}
            <span className="font-pixel-label text-[11px] uppercase">{rmShort(x.from)}</span>
          </PixButton>
        ))}
      </nav>
    </>
  );
}

function Legend({ anchorName }: { anchorName: string }) {
  const t = useT();
  return (
    <div className="relative grid gap-1.5 border-t-[3px] border-ink bg-cloud p-3 pr-8 text-xs">
      {railLines.map((l) => (
        <span key={l.id} className="flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-6 border-y-2 border-ink" style={{ background: railColors[l.id] }} />
          {l.name}
        </span>
      ))}
      <span className="flex items-center gap-2">
        <Sprite art={mapSprites.office} scale={1.5} className="text-ink" />
        {t("Your work: {name}", { name: anchorName })}
      </span>
      <span className="text-ink-soft">{t("Rail drawn station to station; commute times are estimates.")}</span>
      <Sprite art="kopi" scale={1.5} className="absolute right-2 bottom-2 opacity-80" label={t("A kopi, hidden in the corner")} />
    </div>
  );
}
