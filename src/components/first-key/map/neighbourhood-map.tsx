"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { addProtocol, setWorkerUrl, type LayerSpecification, type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { gsap } from "gsap";
import { layers as basemapLayers, namedFlavor } from "@protomaps/basemaps";
import { Building2, Coffee, GraduationCap, HeartPulse, Landmark, ShoppingBasket, TrainFront, Trees, type LucideIcon } from "lucide-react";
import { township } from "@/lib/first-key/township";
import { bearingDeg, centroid, compassOf, distanceM, walkingMinutes } from "@/lib/first-key/geo";
import { developments, onMap } from "@/lib/first-key/developments";
import type { Development, PlaceKind } from "@/lib/first-key/types";
import { useThemeColors } from "../use-theme-colors";
import { drawGlassTexture } from "./glass-texture";
import { usePrefersReducedMotion } from "../use-reduced-motion";

// Turbopack rewrites import.meta.url, so MapLibre can't find its own worker: point it at the packaged file.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL; // our own basemap file; unset = plain background
let registered = false;
const NIGHT_STEPS = 5;

export const COVE_ID = "gamuda-cove"; // the illustrative block sits inside this development
const pins = developments.filter(onMap);

// The township view fits the 12 buildings to 70% of the screen width (any screen size), not a fixed zoom.
const LNGS = township.buildings.flatMap((b) => b.footprint.map((p) => p[0]));
const SPAN_M = (Math.max(...LNGS) - Math.min(...LNGS)) * 111_320 * Math.cos((township.center[1] * Math.PI) / 180);
const M_PER_PX_Z0 = 78_271.5 * Math.cos((township.center[1] * Math.PI) / 180); // MapLibre 512px tiles
const townshipView = () => ({
  center: township.center as [number, number],
  zoom: Math.log2((window.innerWidth * 0.7 * M_PER_PX_Z0) / SPAN_M),
  pitch: 52,
  bearing: 0,
});
// Klang Valley overview: all on-map developments (101.51-101.75 E, 2.88-3.30 N) inside the screen, pins and pills included.
const klangView = () => {
  const mpp = Math.max(78_000 / (window.innerHeight * 0.8), 40_000 / (window.innerWidth * 0.8)); // metres per pixel
  return { center: [101.63, 3.09] as [number, number], zoom: Math.log2(M_PER_PX_Z0 / mpp), pitch: 0, bearing: 0 };
};
const devView = (d: Development) =>
  d.id === COVE_ID ? townshipView() : { center: [d.lng!, d.lat!] as [number, number], zoom: 14.6, pitch: 50, bearing: 0 };
const ICONS: Record<PlaceKind, LucideIcon> = {
  school: GraduationCap,
  clinic: HeartPulse,
  grocery: ShoppingBasket,
  kopitiam: Coffee,
  worship: Landmark,
  park: Trees,
};

const centres = Object.fromEntries(township.buildings.map((b) => [b.id, centroid(b.footprint)]));
const buildingsGeoJson = {
  type: "FeatureCollection" as const,
  features: township.buildings.map((b) => ({
    type: "Feature" as const,
    properties: { id: b.id, height: b.heightM },
    geometry: { type: "Polygon" as const, coordinates: [b.footprint] },
  })),
};
const railGeoJson = {
  type: "Feature" as const,
  properties: {},
  geometry: { type: "LineString" as const, coordinates: township.rail.path },
};

type Props = {
  selectedId?: string;
  onSelect: (buildingId: string | undefined) => void;
  /** The 3D building is showing over the map: stop the opening shot and any camera motion. */
  paused: boolean;
  /** The camera finished flying to the selected building (or it was already there). */
  onArrived: () => void;
  /** Start already at the selected building, no fly-in (a `?building=` link). */
  startAtSelected?: boolean;
  /** The focused development (a pin was clicked, or a `?dev=` link). Undefined = the Klang Valley overview. */
  devId?: string;
  onSelectDev: (id: string) => void;
};

export default function NeighbourhoodMap({ selectedId, onSelect, paused, onArrived, startAtSelected, devId, onSelectDev }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  // Cap the device pixel ratio: the demo laptop / projector draws about 600 extrusions.
  const [pixelRatio] = useState(() => Math.min(window.devicePixelRatio, 1.5));
  // The pmtiles:// protocol is registered once per page; the style only points at the file after that.
  const [protocolReady] = useState(() => {
    if (PMTILES_URL && !registered) {
      addProtocol("pmtiles", new Protocol().tile);
      registered = true;
    }
    return true;
  });
  const withBasemap = !!PMTILES_URL && protocolReady;
  const [initialView] = useState(() => {
    const dev = developments.find((d) => d.id === devId);
    const o = startAtSelected ? townshipView() : dev && onMap(dev) ? devView(dev) : klangView();
    return { longitude: o.center[0], latitude: o.center[1], zoom: o.zoom, pitch: o.pitch, bearing: o.bearing };
  });
  const reduced = usePrefersReducedMotion();
  const colors = useThemeColors();
  // Dark = the theme's background is dark: works for any theme (Kopi O, Teh Susu...) and for a class flip.
  const dark = (colors.background.match(/\d+/g) ?? ["255"]).slice(0, 3).reduce((t, v) => t + Number(v), 0) / 3 < 128;
  // Mount the map only once the PMTiles protocol is registered: one style set at load.
  const ready = !PMTILES_URL || protocolReady;

  // Night reveal: when the theme flips light to dark while open, `lit` runs 0..NIGHT_STEPS and the windows come on.
  const [lit, setLit] = useState(NIGHT_STEPS);
  // the id carries the colours (so any theme gets its own texture) and, in dark, the night-reveal step
  const idFor = (step: number) =>
    `glass-${dark ? "d" : "l"}-${colors["chart-3"]}-${colors.background}-${colors.primary}-${colors.foreground}${dark ? `-L${step}` : ""}`;
  const glassId = idFor(lit);
  // Protomaps layers for the theme, with its flat `buildings` fill swapped for soft, plain extrusions: the real
  // neighbourhood stands up quietly around ours (the township is the only textured thing). Height from the data, else 6 m.
  const basemap = useMemo<LayerSpecification[]>(
    () => [
      ...basemapLayers("protomaps", namedFlavor(dark ? "dark" : "light"), { lang: "en" }).filter((l) => l.id !== "buildings" && l.id !== "background"), // its grey background would show outside the file
      {
        id: "basemap-buildings",
        type: "fill-extrusion",
        source: "protomaps",
        "source-layer": "buildings",
        minzoom: 14,
        filter: ["in", ["get", "kind"], ["literal", ["building", "building_part"]]],
        paint: {
          "fill-extrusion-height": ["coalesce", ["to-number", ["get", "height"], 0], 6],
          "fill-extrusion-base": ["coalesce", ["to-number", ["get", "min_height"], 0], 0],
          "fill-extrusion-opacity": 0.7,
          "fill-extrusion-color": colors.muted,
        },
      },
    ],
    [dark, colors.muted],
  );
  const style = useMemo<StyleSpecification>(
    () => ({
      version: 8,
      glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
      sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${dark ? "dark" : "light"}`,
      sources: {
        ...(withBasemap && {
          protomaps: {
            type: "vector",
            url: `pmtiles://${new URL(PMTILES_URL!, window.location.origin).href}`,
            attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        }),
        buildings: { type: "geojson", data: buildingsGeoJson },
        rail: { type: "geojson", data: railGeoJson },
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": colors.background } },
        ...(withBasemap ? basemap : []),
        {
          id: "rail",
          type: "line",
          minzoom: 14,
          source: "rail",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": colors["chart-3"], "line-width": 4 },
        },
        {
          // Glass towers: the window texture. fill-extrusion-pattern and -color can't share a layer,
          // so the selected building is left out here and drawn tinted by the layer below.
          id: "township-buildings",
          type: "fill-extrusion",
          source: "buildings",
          minzoom: 14,
          filter: ["!=", ["get", "id"], selectedId ?? ""],
          paint: {
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 1,
            "fill-extrusion-pattern": glassId,
          },
        },
        {
          id: "township-selected",
          type: "fill-extrusion",
          source: "buildings",
          minzoom: 14,
          filter: ["==", ["get", "id"], selectedId ?? ""],
          paint: {
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.92,
            "fill-extrusion-color": colors.primary,
          },
        },
      ],
    }),
    [colors, dark, selectedId, glassId, withBasemap, basemap],
  );

  // Draw the window texture for the current theme. MapLibre may ask before or after this runs, so register it now,
  // on every style change, and when the style asks for it by name. In dark all night-reveal frames are drawn up
  // front (tiny canvases), so swapping frames never shows a building without its texture.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const ensure = () => {
      for (const step of dark ? Array.from({ length: NIGHT_STEPS + 1 }, (_, i) => i) : [0]) {
        const id = idFor(step);
        if (!map.hasImage(id)) {
          map.addImage(id, drawGlassTexture(colors, dark, step / NIGHT_STEPS), { pixelRatio: window.innerWidth < 640 ? 3.5 : 2 });
        }
      }
    };
    ensure();
    map.on("styledata", ensure);
    map.on("styleimagemissing", ensure);
    return () => {
      map.off("styledata", ensure);
      map.off("styleimagemissing", ensure);
    };
    // idFor is derived from colors and dark
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, dark, loaded, ready]);

  // Light to dark while /find is open: the windows come on over about 1.2 s. Dark to light, first load and
  // reduced motion all just switch.
  const wasDark = useRef(dark);
  useEffect(() => {
    const was = wasDark.current;
    wasDark.current = dark;
    if (!dark || was || !loaded || reduced) return;
    const ctx = gsap.context(() => {
      const t = { v: 0 };
      setLit(0);
      gsap.to(t, { v: NIGHT_STEPS, duration: 1.2, ease: "none", onUpdate: () => setLit(Math.round(t.v)) });
    });
    return () => {
      ctx.revert();
      setLit(NIGHT_STEPS);
    };
  }, [dark, loaded, reduced]);

  const flyTo = (id: string, then?: () => void) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const [lng, lat] = centres[id];
    const target = { center: [lng, lat] as [number, number], zoom: 18.2, pitch: 60, bearing: map.getBearing() };
    if (reduced) {
      map.jumpTo(target);
      then?.();
      return;
    }
    map.once("moveend", () => then?.());
    map.flyTo({ ...target, duration: 1400, essential: false });
  };

  // Fly in when a building is selected; fly back out when the 3D view closes.
  const first = useRef(true);
  useEffect(() => {
    if (!loaded) return;
    const isFirst = first.current;
    first.current = false;
    if (!selectedId) return;
    if (isFirst && startAtSelected) {
      const [lng, lat] = centres[selectedId];
      mapRef.current?.getMap().jumpTo({ center: [lng, lat], zoom: 18.2, pitch: 60 });
      onArrived();
      return;
    }
    flyTo(selectedId, onArrived);
    // flyTo is stable enough per render; we only react to a new selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loaded]);

  // Back from the 3D view: settle on the township. (A selected building always means Gamuda Cove.)
  const wasPaused = useRef(false);
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (wasPaused.current && !paused && map) {
      if (reduced) map.jumpTo(townshipView());
      else map.flyTo({ ...townshipView(), bearing: map.getBearing(), duration: 1200 });
    }
    wasPaused.current = paused;
  }, [paused, reduced]);

  // Fly to the focused development, or back out to the Klang Valley. The first run is skipped: initialView is already there.
  const firstDev = useRef(true);
  useEffect(() => {
    if (!loaded) return;
    const isFirst = firstDev.current;
    firstDev.current = false;
    const map = mapRef.current?.getMap();
    if (isFirst || !map || selectedId) return;
    const dev = developments.find((d) => d.id === devId);
    const target = dev && onMap(dev) ? devView(dev) : klangView();
    if (reduced) map.jumpTo(target);
    else map.flyTo({ ...target, duration: 2200, essential: false });
    // selectedId has its own fly-in above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devId, loaded]);

  const onClick = (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties?.id;
    if (id) onSelect(id);
  };
  const showTownship = devId === COVE_ID || !!selectedId;
  const overviewShot = !devId && !selectedId;
  const narrow = typeof window !== "undefined" && window.innerWidth < 640; // phone: compact, differently fanned pills

  const from = selectedId ? centres[selectedId] : undefined;

  return (
    <div className="absolute inset-0">
      {ready && (
      <Map
        ref={mapRef}
        pixelRatio={pixelRatio}
        initialViewState={initialView}
        mapStyle={style}
        maxPitch={70}
        interactiveLayerIds={["township-buildings", "township-selected"]}
        cursor="auto"
        onError={(e) => {
          // Only a request that was really aborted (the view moved on) is quiet. Everything else stays loud, most of
          // all a failed fetch of the PMTiles file (wrong URL, CORS on a cross-origin host).
          const err = e.error as (Error & { name?: string }) | undefined;
          const aborted = err?.name === "AbortError" || /abort/i.test(err?.message ?? "");
          (aborted ? console.warn : console.error)(err);
        }}
        onClick={onClick}
        onLoad={() => setLoaded(true)}
        style={{ width: "100%", height: "100%" }}
      >
        {overviewShot &&
          pins.map((d) => (
            <Marker
              key={d.id}
              longitude={d.lng}
              latitude={d.lat}
              anchor={(narrow ? PILL_ANCHOR_NARROW : PILL_ANCHOR)[d.id] ?? "bottom"}
              offset={(narrow ? PILL_OFFSET_NARROW : PILL_OFFSET)[d.id]}
            >
              <DevPill dev={d} compact={narrow} onClick={() => onSelectDev(d.id)} />
            </Marker>
          ))}
        {showTownship && !selectedId && (
          <Marker longitude={township.center[0]} latitude={township.center[1] - 80 / 110_574} anchor="top">
            <p className="pointer-events-none max-w-[16rem] rounded-lg border-2 border-primary bg-card px-3 py-1.5 text-center text-xs text-card-foreground shadow-md sm:max-w-none">
              <strong>{township.name}</strong>: an illustrative block at Gamuda Cove; made-up units and prices
            </p>
          </Marker>
        )}
        {showTownship &&
          township.rail.stations.map((s) => (
            <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="bottom">
              <Pin label={s.name} detail={detail(from, s.lng, s.lat)} Icon={TrainFront} tone="station" />
            </Marker>
          ))}
        {showTownship &&
          township.places.map((p) => (
            <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="bottom">
              <Pin label={p.name} detail={detail(from, p.lng, p.lat)} Icon={ICONS[p.kind]} />
            </Marker>
          ))}
      </Map>
      )}
    </div>
  );
}

function detail(from: [number, number] | undefined, lng: number, lat: number) {
  if (!from) return undefined;
  const m = distanceM(from, [lng, lat]);
  return `${Math.round(m)} m, ${walkingMinutes(m)} min walk, ${compassOf(bearingDeg(from, [lng, lat]))}`;
}

// The Gardens Park / Gamuda Gardens / Kundang pins sit about 2 km apart (tens of pixels at this zoom): fan the pills out.
type Anchor = "left" | "right" | "top-right" | "top-left" | "top" | "bottom";
const PILL_ANCHOR: Record<string, Anchor> = { "gamuda-gardens": "left", "gardens-park": "right", "kundang-estates": "top-right" };
const PILL_ANCHOR_NARROW: Record<string, Anchor> = { "gamuda-gardens": "left", "gardens-park": "bottom", "kundang-estates": "top-left" };
const PILL_OFFSET: Record<string, [number, number]> = { "kundang-estates": [0, 22] };
const PILL_OFFSET_NARROW: Record<string, [number, number]> = { "kundang-estates": [-4, 20] };

function DevPill({ dev, compact, onClick }: { dev: Development; compact: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full border bg-card p-1 pr-3 text-left text-card-foreground shadow-md transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
      aria-label={`${dev.name}, ${dev.town}${dev.launch ? `, from RM${dev.launch.fromPrice.toLocaleString()}` : ""}`}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Building2 className="size-4" aria-hidden />
      </span>
      <span className="flex flex-col text-[11px] leading-tight">
        <span className="whitespace-nowrap text-xs font-semibold">{dev.name}</span>
        {!compact && <span className="whitespace-nowrap text-muted-foreground">{dev.town.replace(", Selangor", "").replace(", Johor", "")}</span>}
        {dev.launch && <span className="whitespace-nowrap font-medium text-primary">From RM{dev.launch.fromPrice.toLocaleString()}</span>}
      </span>
    </button>
  );
}

// White rounded pill: icon, name and (once a building is picked) the walk from it.
function Pin({ label, detail, Icon, tone }: { label: string; detail?: string; Icon: LucideIcon; tone?: "station" }) {
  return (
    <div
      className="pointer-events-none flex items-center gap-1.5 rounded-full border bg-card p-1 text-card-foreground shadow-md sm:pr-3"
      title={detail ? `${label}: ${detail}` : label}
    >
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
          tone === "station" ? "bg-chart-3 text-background" : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className={`${detail ? "" : "sr-only sm:not-sr-only"} flex flex-col text-[11px] leading-tight`}>
        <span className="whitespace-nowrap font-medium">{label}</span>
        {detail && <span className="whitespace-nowrap text-muted-foreground">{detail}</span>}
      </span>
    </div>
  );
}
