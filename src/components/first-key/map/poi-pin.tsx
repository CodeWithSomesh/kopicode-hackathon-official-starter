import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Coffee, GraduationCap, HeartPulse, Landmark, ShoppingBasket, TrainFront, Trees, type LucideIcon } from "lucide-react";
import { township } from "@/lib/first-key/township";
import { bearingDeg, compassOf, distanceM, walkingMinutes } from "@/lib/first-key/geo";
import type { PlaceKind } from "@/lib/first-key/types";
import { defineSprite, Sprite } from "@/components/homelander/sprite";

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

/** Pixel-frame chip: icon, plus the name (and the walk from the block) when `named`. The name stays in the DOM for screen readers.
 * Kopitiam pins (the Coffee icon) are real buttons: one tap shows the name and walk, three quick taps drop the kopi egg. */
export function Pin(props: {
  id: string;
  d: number;
  hidden?: boolean;
  label: string;
  detail?: string;
  Icon: LucideIcon;
  tone?: "station";
  named?: boolean;
}) {
  return props.Icon === Coffee ? (
    <KopiPin {...props} />
  ) : (
    <PinBody {...props} />
  );
}

type PinProps = Parameters<typeof Pin>[0];

function PinBody({
  id,
  d,
  label,
  detail,
  Icon,
  tone,
  named,
  hidden,
}: PinProps) {
  return (
    <div
      data-poi={id}
      data-d={d}
      className={`pix-frame pointer-events-none flex items-center p-1 text-ink${hidden ? " invisible" : ""}`}
      style={
        {
          "--pix-fill": "var(--j-surface, #ffffff)",
          "--pix-drop": "3px",
        } as React.CSSProperties
      }
      title={detail ? `${label}: ${detail}` : label}
    >
      <span
        data-icon
        className={`flex size-6 shrink-0 items-center justify-center ${tone === "station" ? "bg-pandan-deep text-white" : "bg-kaya text-ink"}`}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span
        data-label
        className={`${named ? "max-w-none pr-1.5 pl-1.5" : "max-w-0 overflow-hidden"} flex flex-col font-pixel-label text-[11px] leading-tight`}
      >
        <span className="whitespace-nowrap font-medium">{label}</span>
        {detail && (
          <span className="whitespace-nowrap text-ink-soft">{detail}</span>
        )}
      </span>
    </div>
  );
}

// The map's own handlers sit on its container, below React's root listener, so React's stopPropagation is too late:
// the button swallows these natively, or a tap pans the map and a double tap zooms it.
const SWALLOW = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "touchstart",
  "touchend",
  "click",
  "dblclick",
  "contextmenu",
] as const;
const TAPS = 3;
const TAP_WINDOW_MS = 1500;
const EGG_MS = 8000;
const CHIP_HALF = 80; // px: about half the chip's width

function KopiPin(props: PinProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const taps = useRef<number[]>([]);
  const [open, setOpen] = useState(false);
  const [egg, setEgg] = useState(0); // 0 = none; a new number replays the drop
  // Where it hangs (the icon's centre, the pin's bottom edge, in viewport px) and how far the chip shifts to stay on screen.
  const [at, setAt] = useState<{ x: number; y: number; nudge: number; host: Element }>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    const tap = () => {
      const now = performance.now();
      taps.current = [
        ...taps.current.filter((t) => now - t < TAP_WINDOW_MS),
        now,
      ];
      setOpen(true);
      if (taps.current.length >= TAPS) {
        taps.current = [];
        const r = el.getBoundingClientRect();
        // the icon's centre (p-1 + half of size-6), kept far enough from the screen edge for the whole bag
        const x = Math.min(Math.max(r.left + 16, 30), innerWidth - 30);
        setAt({ x, y: r.bottom, host: el.closest(".homelander-world") ?? document.body, nudge: Math.max(0, 8 + CHIP_HALF - x) - Math.max(0, x + CHIP_HALF - (innerWidth - 8)) });
        setEgg(now);
      }
    };
    SWALLOW.forEach((t) => el.addEventListener(t, stop));
    el.addEventListener("click", tap);
    return () => {
      SWALLOW.forEach((t) => el.removeEventListener(t, stop));
      el.removeEventListener("click", tap);
    };
  }, []);

  // Any tap elsewhere closes the name and the egg; the egg also leaves by itself.
  useEffect(() => {
    if (!open && !egg) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
        setEgg(0);
      }
    };
    const gone = () => {
      setOpen(false);
      setEgg(0);
    };
    document.addEventListener("pointerdown", away);
    addEventListener("wheel", gone); // the map is moving: the egg would hang in the wrong place
    // Each marker is its own stacking layer: lift this one so the egg and the name sit over the neighbouring pins.
    const marker = ref.current?.closest<HTMLElement>(
      ".mapboxgl-marker, .maplibregl-marker",
    );
    const z = marker?.style.zIndex ?? "";
    if (marker) marker.style.zIndex = "40";
    const t = egg ? setTimeout(() => setEgg(0), EGG_MS) : undefined;
    return () => {
      document.removeEventListener("pointerdown", away);
      removeEventListener("wheel", gone);
      clearTimeout(t);
      if (marker) marker.style.zIndex = z;
    };
  }, [open, egg]);

  const { label, detail, hidden } = props;
  return (
    <button
      ref={ref}
      type="button"
      aria-label={detail ? `${label}, ${detail}` : label}
      aria-expanded={open}
      className={`pointer-events-auto relative cursor-pointer${hidden ? " invisible" : ""}`}
    >
      <PinBody {...props} hidden={false} named={props.named || open} />
      {/* Portalled into the themed root (tokens, pixel frames), fixed at the pin: it can hang over the panels on a phone. */}
      {egg > 0 && at && createPortal(<KopiEgg key={egg} x={at.x} y={at.y} nudge={at.nudge} />, at.host)}
    </button>
  );
}

// An iced kopi in a tied plastic bag with a straw: ink outline, kopi in the theme's primary brown, ice in cloud, straw and tie in raya.
const KOPI_BAG = defineSprite(
  [
    "....ss.....",
    ".....s.....",
    "....#s#....",
    "....#r#....",
    "...#bsb#...",
    "..#bbsbb#..",
    ".#bbbsbbb#.",
    "#hbbbsbbbb#",
    "#hkkksikkk#",
    "#hkikskkik#",
    "#kkkkskkkk#",
    "#kikkskikk#",
    "#kkkkkkkkk#",
    "#kkikkkkik#",
    ".#kkkkkkk#.",
    "..#######..",
  ],
  {
    s: "var(--color-raya)",
    r: "var(--color-raya-deep)",
    b: "rgba(255,255,255,0.75)",
    h: "#ffffff",
    k: "var(--color-primary)",
    i: "var(--color-cloud)",
  },
);

// Drops on a string, swings like a pendulum and settles. Reduced motion: it is simply there.
const EGG_CSS = `
@keyframes kopi-drop { from { transform: translateY(-48px); opacity: 0 } 35% { opacity: 1 } to { transform: none; opacity: 1 } }
@keyframes kopi-swing { 0% { transform: rotate(0) } 12% { transform: rotate(26deg) } 30% { transform: rotate(-18deg) } 48% { transform: rotate(11deg) } 64% { transform: rotate(-6deg) } 80% { transform: rotate(3deg) } 100% { transform: rotate(0) } }
.kopi-egg { animation: kopi-drop 450ms cubic-bezier(.3,1.4,.6,1) both }
.kopi-egg-swing { transform-origin: top center; animation: kopi-swing 2.6s ease-out 350ms both }
@media (prefers-reduced-motion: reduce) { .kopi-egg, .kopi-egg-swing { animation: none } }
`;

function KopiEgg({ x, y, nudge }: { x: number; y: number; nudge: number }) {
  return (
    // Hangs from the icon's centre (p-1 + half of size-6 = 16 px), whether or not the name is showing.
    <span
      data-kopi-egg
      className="pointer-events-none fixed z-50 -translate-x-1/2"
      style={{ left: x, top: y }}
    >
      <span className="kopi-egg flex flex-col items-center">
        <style>{EGG_CSS}</style>
        <span className="kopi-egg-swing flex flex-col items-center">
          <span className="h-9 w-0.5 bg-ink" aria-hidden />
          <Sprite art={KOPI_BAG} scale={4} className="text-ink" aria-hidden />
        </span>
        <span
          role="status"
          className="pix-frame mt-1 whitespace-nowrap px-2 py-0.5 font-pixel-label text-[11px] text-ink"
          style={
            {
              "--pix-fill": "var(--color-kaya)",
              "--pix-drop": "2px",
              transform: nudge ? `translateX(${nudge}px)` : undefined,
            } as React.CSSProperties
          }
        >
          Kopi peng, ikat tepi!
        </span>
      </span>
    </span>
  );
}
