"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import { layers as basemapLayers, namedFlavor } from "@protomaps/basemaps";
import { useTheme } from "next-themes";
import { Coffee, GraduationCap, HeartPulse, Landmark, ShoppingBasket, TrainFront, Trees, type LucideIcon } from "lucide-react";
import { township } from "@/lib/first-key/township";
import { bearingDeg, centroid, compassOf, distanceM, walkingMinutes } from "@/lib/first-key/geo";
import type { PlaceKind } from "@/lib/first-key/types";
import { useThemeColors } from "../use-theme-colors";
import { usePrefersReducedMotion } from "../use-reduced-motion";

// Turbopack rewrites import.meta.url, so MapLibre can't find its own worker: point it at the packaged file.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);

const KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY;
const OVERVIEW = { center: township.center as [number, number], zoom: 16.2, pitch: 52, bearing: 0 };
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
  const reduced = usePrefersReducedMotion();
  const colors = useThemeColors();
  const { resolvedTheme } = useTheme();
  const dark = DARK_THEMES.includes(resolvedTheme ?? "");

  const style = useMemo<StyleSpecification>(
    () => ({
      version: 8,
      glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
      sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${dark ? "dark" : "light"}`,
      sources: {
        ...(KEY && {
          protomaps: {
            type: "vector",
            tiles: [`https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=${KEY}`],
            maxzoom: 15,
            attribution:
              '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        }),
        buildings: { type: "geojson", data: buildingsGeoJson },
        rail: { type: "geojson", data: railGeoJson },
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": colors.background } },
        ...(KEY ? basemapLayers("protomaps", namedFlavor(dark ? "dark" : "light"), { lang: "en" }) : []),
        {
          id: "rail",
          type: "line",
          source: "rail",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": colors["chart-3"], "line-width": 4 },
        },
        {
          id: "township-buildings",
          type: "fill-extrusion",
          source: "buildings",
          minzoom: 14,
          paint: {
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.95,
            "fill-extrusion-color": ["case", ["==", ["get", "id"], selectedId ?? ""], colors.primary, colors["muted-foreground"]],
          },
        },
      ],
    }),
    [colors, dark, selectedId],
  );

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
      if (reduced) map.jumpTo(OVERVIEW);
      else map.flyTo({ ...OVERVIEW, bearing: map.getBearing(), duration: 1200 });
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
      <Map
        ref={mapRef}
        initialViewState={{ longitude: OVERVIEW.center[0], latitude: OVERVIEW.center[1], zoom: OVERVIEW.zoom, pitch: OVERVIEW.pitch, bearing: OVERVIEW.bearing }}
        mapStyle={style}
        maxPitch={70}
        interactiveLayerIds={["township-buildings"]}
        cursor="auto"
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
    </div>
  );
}

function detail(from: [number, number] | undefined, lng: number, lat: number) {
  if (!from) return undefined;
  const m = distanceM(from, [lng, lat]);
  return `${Math.round(m)} m, ${walkingMinutes(m)} min walk, ${compassOf(bearingDeg(from, [lng, lat]))}`;
}

function Pin({ label, detail, Icon, tone }: { label: string; detail?: string; Icon: LucideIcon; tone?: "station" }) {
  return (
    <div className="pointer-events-none flex flex-col items-center" title={detail ? `${label}: ${detail}` : label}>
      {detail && (
        <span className="mb-1 whitespace-nowrap rounded border bg-card px-1.5 py-0.5 text-[11px] text-card-foreground shadow-sm">
          {label} · {detail}
        </span>
      )}
      <span
        className={`flex size-7 items-center justify-center rounded-full border shadow-sm ${
          tone === "station" ? "bg-chart-3 text-background" : "bg-card text-card-foreground"
        }`}
      >
        <Icon className="size-4" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    </div>
  );
}
