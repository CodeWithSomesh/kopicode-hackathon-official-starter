"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { addProtocol, setWorkerUrl, type LayerSpecification, type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { layers as basemapLayers, namedFlavor } from "@protomaps/basemaps";
import { useTheme } from "next-themes";
import { Coffee, GraduationCap, HeartPulse, Landmark, ShoppingBasket, TrainFront, Trees, type LucideIcon } from "lucide-react";
import { township } from "@/lib/first-key/township";
import { bearingDeg, centroid, compassOf, distanceM, walkingMinutes } from "@/lib/first-key/geo";
import type { PlaceKind } from "@/lib/first-key/types";
import { useThemeColors } from "../use-theme-colors";
import { drawGlassTexture } from "./glass-texture";
import { usePrefersReducedMotion } from "../use-reduced-motion";

// Turbopack rewrites import.meta.url, so MapLibre can't find its own worker: point it at the packaged file.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL; // our own basemap file; unset = plain background
let registered = false;

// The opening shot fits the 12 buildings to 70% of the screen width (any screen size), not a fixed zoom.
const LNGS = township.buildings.flatMap((b) => b.footprint.map((p) => p[0]));
const SPAN_M = (Math.max(...LNGS) - Math.min(...LNGS)) * 111_320 * Math.cos((township.center[1] * Math.PI) / 180);
const M_PER_PX_Z0 = 78_271.5 * Math.cos((township.center[1] * Math.PI) / 180); // MapLibre 512px tiles
const overviewZoom = () => Math.log2((window.innerWidth * 0.7 * M_PER_PX_Z0) / SPAN_M);
const overview = () => ({ center: township.center as [number, number], zoom: overviewZoom(), pitch: 52, bearing: 0 });
const DARK_THEMES = ["dark", "kopi-o"];
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
};

export default function NeighbourhoodMap({ selectedId, onSelect, paused, onArrived, startAtSelected }: Props) {
  const mapRef = useRef<MapRef>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const stopped = useRef(false); // user has touched the map: no more auto-rotation
  const [loaded, setLoaded] = useState(false);
  // The pmtiles:// protocol is registered once per page; the style only points at the file after that.
  const [protocolReady, setProtocolReady] = useState(false);
  useEffect(() => {
    if (!PMTILES_URL) return;
    if (!registered) {
      addProtocol("pmtiles", new Protocol().tile);
      registered = true;
    }
    setProtocolReady(true);
  }, []);
  const withBasemap = !!PMTILES_URL && protocolReady;
  const [initialView] = useState(() => {
    const o = overview();
    return { longitude: o.center[0], latitude: o.center[1], zoom: o.zoom, pitch: o.pitch, bearing: o.bearing };
  });
  const reduced = usePrefersReducedMotion();
  const colors = useThemeColors();
  const { resolvedTheme } = useTheme();
  const dark = DARK_THEMES.includes(resolvedTheme ?? "");
  // Mount the map only once the theme is known and the protocol is registered: one style set, no rebuild that
  // aborts in-flight tile requests (those logged "Failed to fetch" at load).
  const ready = resolvedTheme !== undefined && (!PMTILES_URL || protocolReady);

  // the id carries the colours, so any theme (Kopi O, Teh Susu...) gets its own texture
  const glassId = `glass-${dark ? "d" : "l"}-${colors["chart-3"]}-${colors.background}-${colors.primary}-${colors.foreground}`;
  // Protomaps layers for the theme, with its flat `buildings` fill swapped for soft, plain extrusions: the real
  // neighbourhood stands up quietly around ours (the township is the only textured thing). Height from the data, else 6 m.
  const basemap = useMemo<LayerSpecification[]>(
    () => [
      ...basemapLayers("protomaps", namedFlavor(dark ? "dark" : "light"), { lang: "en" }).filter((l) => l.id !== "buildings"),
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
  // on every style change, and when the style asks for it by name (the id changes with the theme).
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const ensure = () => {
      if (!map.hasImage(glassId)) map.addImage(glassId, drawGlassTexture(colors, dark), { pixelRatio: window.innerWidth < 640 ? 3.5 : 2 });
    };
    ensure();
    map.on("styledata", ensure);
    map.on("styleimagemissing", ensure);
    return () => {
      map.off("styledata", ensure);
      map.off("styleimagemissing", ensure);
    };
  }, [colors, dark, glassId, loaded, ready]);

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

  const wasPaused = useRef(false);
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (wasPaused.current && !paused && map) {
      if (reduced) map.jumpTo(overview());
      else map.flyTo({ ...overview(), bearing: map.getBearing(), duration: 1200 });
    }
    wasPaused.current = paused;
  }, [paused, reduced]);

  // Slow opening shot (about 3 degrees a second) until the first user input.
  useEffect(() => {
    if (!loaded || reduced || paused || selectedId || startAtSelected || stopped.current) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const start = performance.now();
    const from = map.getBearing();
    let raf = requestAnimationFrame(function tick(now) {
      if (stopped.current) return;
      map.setBearing(from + ((now - start) / 1000) * 3);
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [loaded, reduced, paused, selectedId, startAtSelected]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const stop = () => (stopped.current = true);
    const evts = ["pointerdown", "wheel", "keydown", "touchstart"] as const;
    evts.forEach((e) => el.addEventListener(e, stop, { passive: true }));
    return () => evts.forEach((e) => el.removeEventListener(e, stop));
  }, []);

  const onClick = (e: MapLayerMouseEvent) => onSelect(e.features?.[0]?.properties?.id);

  const from = selectedId ? centres[selectedId] : undefined;

  return (
    <div ref={wrap} className="absolute inset-0">
      {ready && (
      <Map
        ref={mapRef}
        initialViewState={initialView}
        mapStyle={style}
        maxPitch={70}
        interactiveLayerIds={["township-buildings", "township-selected"]}
        cursor="auto"
        onError={(e) => {
          // A tile request dropped mid-flight (the view moved on) surfaces as "Failed to fetch" from the PMTiles source:
          // a warning, not an error. Anything else is logged as before.
          const tileDrop = e.error?.message === "Failed to fetch" && (e as unknown as { sourceId?: string }).sourceId === "protomaps";
          (tileDrop ? console.warn : console.error)(e.error);
        }}
        onClick={onClick}
        onLoad={() => setLoaded(true)}
        style={{ width: "100%", height: "100%" }}
      >
        {township.rail.stations.map((s) => (
          <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="bottom">
            <Pin label={s.name} detail={detail(from, s.lng, s.lat)} Icon={TrainFront} tone="station" />
          </Marker>
        ))}
        {township.places.map((p) => (
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
