import { useEffect, useState } from "react";
import { Coffee, GraduationCap, HeartPulse, Landmark, ShoppingBasket, TrainFront, Trees, type LucideIcon } from "lucide-react";
import { township } from "@/lib/first-key/township";
import { bearingDeg, compassOf, distanceM, walkingMinutes } from "@/lib/first-key/geo";
import type { PlaceKind } from "@/lib/first-key/types";

// Shared by the MapLibre and the Mapbox map: the stations and places around the illustrative block.

export const POI_ICONS: Record<PlaceKind, LucideIcon> = {
  school: GraduationCap,
  clinic: HeartPulse,
  grocery: ShoppingBasket,
  kopitiam: Coffee,
  worship: Landmark,
  park: Trees,
};
export { TrainFront };

export function poiDetail(from: [number, number] | undefined, lng: number, lat: number) {
  if (!from) return undefined;
  const m = distanceM(from, [lng, lat]);
  return `${Math.round(m)} m, ${walkingMinutes(m)} min walk, ${compassOf(bearingDeg(from, [lng, lat]))}`;
}

/** Pins whose name is shown: at most NAMED, nearest to the selected block (or the township centre) first, and only where the label
 * collides with no other pin, marker or panel. Measured on the real DOM after the map settles; every other pin stays icon-only. */
const NAMED = 3;
const MARKER = ".mapboxgl-marker, .maplibregl-marker";
// `shown` is null until the first measurement: every icon shows, no names.
type Fit = { shown: Set<string> | null; named: Set<string> };
const NONE: Fit = { shown: null, named: new Set() };
export const poiHidden = (f: Fit, id: string) => !!f.shown && !f.shown.has(id);
type Box = { l: number; t: number; r: number; b: number };
const hit = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const box = (e: Element, pad = 0): Box => {
  const r = e.getBoundingClientRect();
  return { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad };
};

function fitNamed(): Fit {
  const pois = [...document.querySelectorAll<HTMLElement>("[data-poi]")].map((el) => {
    const icon = box(el.querySelector("[data-icon]")!, 3);
    const w = el.querySelector<HTMLElement>("[data-label]")!.scrollWidth + 18; // gap + padding
    const cx = (icon.l + icon.r) / 2;
    return { id: el.dataset.poi!, d: Number(el.dataset.d), icon, label: { l: cx - (icon.r - icon.l + w) / 2, t: icon.t, r: cx + (icon.r - icon.l + w) / 2, b: icon.b + 14 } as Box };
  });
  const others = [...document.querySelectorAll(MARKER)].filter((m) => !m.querySelector("[data-poi]")).map((m) => box(m, 2));
  const ui = [...document.querySelectorAll("[data-obstacle]")].map((e) => box(e, 2));
  const fixed = [...others, ...ui];
  const byDistance = [...pois].sort((a, b) => a.d - b.d);
  // 1. which icons show: nearest first, an icon that would sit on a nearer one (or on a pill / the panel) waits until the map is closer
  const shown = new Set<string>();
  const kept: Box[] = [];
  for (const p of byDistance) {
    if (fixed.some((o) => hit(p.icon, o)) || kept.some((k) => hit(p.icon, k))) continue;
    shown.add(p.id);
    kept.push(p.icon);
  }
  // 2. which of those also show a name: at most NAMED, only where the label touches nothing
  const named = new Set<string>();
  const taken: Box[] = [];
  for (const p of byDistance) {
    if (named.size >= NAMED) break;
    if (!shown.has(p.id)) continue;
    const clash =
      pois.some((q) => q.id !== p.id && shown.has(q.id) && hit(p.label, q.icon)) ||
      taken.some((t) => hit(p.label, t)) ||
      fixed.some((o) => hit(p.label, o)) ||
      p.label.l < 0 || p.label.r > innerWidth;
    if (!clash) {
      named.add(p.id);
      taken.push(p.label);
    }
  }
  return { shown, named };
}

type Idle = { on(t: "idle", f: () => void): unknown; off(t: "idle", f: () => void): unknown };
/** Re-fit the pins each time the map goes idle (after a fly-in, a zoom, a resize). */
export function useNamedPois(getMap: () => Idle | undefined, active: boolean, from: [number, number] | undefined): Fit {
  const [fit, setFit] = useState<Fit | null>(null);
  useEffect(() => {
    const map = getMap();
    if (!map || !active) return;
    const run = () => {
      const next = fitNamed();
      const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((id) => b.has(id));
      setFit((prev) => (prev && same(prev.shown ?? new Set(), next.shown!) && same(prev.named, next.named) ? prev : next));
    };
    map.on("idle", run);
    run();
    const late = setTimeout(run, 500); // markers are placed a frame after they mount
    return () => {
      clearTimeout(late);
      map.off("idle", run);
    };
    // getMap only reads a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, from]);
  return active && fit ? fit : NONE;
}

/** Distance (m) from the selected block, or the township centre: orders the pins for naming. */
export function poiRank(from: [number, number] | undefined, lng: number, lat: number) {
  return Math.round(distanceM(from ?? township.center, [lng, lat]));
}

/** Pixel-frame chip: icon, plus the name (and the walk from the block) when `named`. The name stays in the DOM for screen readers. */
export function Pin({ id, d, label, detail, Icon, tone, named, hidden }: { id: string; d: number; hidden?: boolean; label: string; detail?: string; Icon: LucideIcon; tone?: "station"; named?: boolean }) {
  return (
    <div
      data-poi={id}
      data-d={d}
      className={`pix-frame pointer-events-none flex items-center p-1 text-ink${hidden ? " invisible" : ""}`}
      style={{ "--pix-fill": "var(--j-surface, #ffffff)", "--pix-drop": "3px" } as React.CSSProperties}
      title={detail ? `${label}: ${detail}` : label}
    >
      <span data-icon className={`flex size-6 shrink-0 items-center justify-center ${tone === "station" ? "bg-pandan-deep text-white" : "bg-kaya text-ink"}`}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span data-label className={`${named ? "max-w-none pr-1.5 pl-1.5" : "max-w-0 overflow-hidden"} flex flex-col font-pixel-label text-[11px] leading-tight`}>
        <span className="whitespace-nowrap font-medium">{label}</span>
        {detail && <span className="whitespace-nowrap text-ink-soft">{detail}</span>}
      </span>
    </div>
  );
}
