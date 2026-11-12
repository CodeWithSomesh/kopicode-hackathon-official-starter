"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import Map, { Layer, Marker, Source, type MapRef, type MapMouseEvent } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import { gsap } from "gsap";
import { township } from "@/lib/first-key/township";
import { centroid } from "@/lib/first-key/geo";
import { Pin, POI_ICONS, poiDetail, poiHidden, poiRank, TrainFront, useNamedPois } from "./poi-pin";
import { anchorOptions, townshipById } from "@/lib/homelander/data";
import { useHomeLander } from "@/lib/homelander/store";
import { pillLean, pillLeanPhone, pillNudgePhone, railGeoJSON, stationGeoJSON, towns } from "@/app/(homelander)/_landing/map-data";
import { TownPill, WorkMarker } from "@/app/(homelander)/_landing/town-pill";
import type { ControlMap } from "@/app/(homelander)/_landing/map-controls";
import { useMapColors, useMapDusk } from "../use-map-colors";
import { drawGlassTexture, mix } from "./glass-texture";
import { usePrefersReducedMotion } from "../use-reduced-motion";

// Mapbox GL JS v3 + the Standard style (3D buildings, landmarks, building shadows, lightPreset). Used when
// NEXT_PUBLIC_MAPBOX_TOKEN is set; neighbourhood-map.tsx (MapLibre) is the fallback. Same props, same camera helpers.
// Worker: mapbox-gl v3 ships its worker inside the main bundle (blob), so Turbopack needs no setWorkerUrl copy like MapLibre did.
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const NIGHT_STEPS = 5;

export const COVE_ID = "cove"; // the illustrative block sits inside this township (id in src/lib/homelander/data.ts)

// Camera padding that keeps the focus clear of the floating header, township list, panel, sheet and tab bar.
function cameraPadding(panelOpen: boolean) {
  if (window.matchMedia("(min-width: 1024px)").matches) return { top: 110, bottom: 60, left: 340, right: panelOpen ? 440 : 110 };
  const h = window.innerHeight;
  return { top: 150, bottom: panelOpen ? Math.min(h * 0.52, 460) + 150 : 140, left: 30, right: 70 };
}

// The township view fits the 12 buildings into the free part of the screen (any screen size), not a fixed zoom.
const LNGS = township.buildings.flatMap((b) => b.footprint.map((p) => p[0]));
const SPAN_M = (Math.max(...LNGS) - Math.min(...LNGS)) * 111_320 * Math.cos((township.center[1] * Math.PI) / 180);
const M_PER_PX_Z0 = 78_271.5 * Math.cos((township.center[1] * Math.PI) / 180); // 512px tiles (Mapbox too)
const townshipView = () => {
  const padding = cameraPadding(true);
  const free = Math.max(200, window.innerWidth - padding.left - padding.right);
  return { center: township.center as [number, number], zoom: Math.log2((free * 0.9 * M_PER_PX_Z0) / SPAN_M), pitch: 52, bearing: 0, padding };
};
// Klang Valley overview: every township (101.51-101.79 E, 2.88-3.29 N) inside the free part of the screen, pills included.
const klangView = () => {
  const padding = cameraPadding(false);
  const mpp = Math.max(62_000 / (window.innerHeight - padding.top - padding.bottom), 36_000 / (window.innerWidth - padding.left - padding.right));
  // Tilted like PayGap (pitch 52, a slight turn). Zoom and centre were tuned with a probe so all seven pills stay on screen,
  // the far northern ones included: wide screens sit a little closer and further south than phones.
  const wide = window.matchMedia("(min-width: 1024px)").matches;
  return { center: (wide ? [101.65, 3.06] : [101.58, 3.1]) as [number, number], zoom: Math.log2(M_PER_PX_Z0 / mpp) + (wide ? 0.4 : -0.08), pitch: 52, bearing: -12, padding };
};
const devView = (id: string) => {
  const t = townshipById[id];
  if (id === COVE_ID) return townshipView();
  return { center: [t.pos.lng, t.pos.lat] as [number, number], zoom: 14.6, pitch: 50, bearing: 0, padding: cameraPadding(true) };
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
  paused: boolean;
  onArrived: () => void;
  startAtSelected?: boolean;
  devId?: string;
  onSelectDev: (id: string) => void;
  onMapReady?: (map: ControlMap) => void;
};

// Standard's basemap config: calm "faded" theme so our pills and towers stand out; no POI/transit icons (our own pins do that job).
// Detail on (Standard's own options, read from the style's schema): default theme (faded washes the facades out), 3D buildings,
// facades (off by default), landmarks, trees and objects. Light preset: night > dusk > day.
const standardConfig = (dark: boolean, dusk: boolean) => ({
  lightPreset: dark ? "night" : dusk ? "dusk" : "day",
  theme: "default",
  show3dObjects: true,
  show3dBuildings: true,
  show3dFacades: true,
  show3dLandmarks: true,
  show3dTrees: true,
  showLandmarkIcons: true,
  showPointOfInterestLabels: false,
  showTransitLabels: false,
});

export default function MapboxMap({ selectedId, onSelect, paused, onArrived, startAtSelected, devId, onSelectDev, onMapReady }: Props) {
  const hl = useHomeLander();
  const workAnchor = anchorOptions.find((a) => a.id === hl.anchorId) ?? anchorOptions[0]!;
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [initialView] = useState(() => {
    const o = startAtSelected ? townshipView() : devId && townshipById[devId] ? devView(devId) : klangView();
    return { longitude: o.center[0], latitude: o.center[1], zoom: o.zoom, pitch: o.pitch, bearing: o.bearing, padding: o.padding };
  });
  const reduced = usePrefersReducedMotion();
  const { colors, dark } = useMapColors();
  const dusk = useMapDusk() && !dark;

  const [lit, setLit] = useState(NIGHT_STEPS);
  const idFor = (step: number) =>
    `glass-${dark ? "d" : "l"}-${colors["chart-3"]}-${colors.background}-${colors.primary}-${colors.foreground}${dark ? `-L${step}` : ""}`;
  const glassId = idFor(lit);
  const roofColor = dark ? mix(colors.background, colors.foreground, 0.3) : mix(colors.foreground, colors.background, 0.72);

  // Night (the Night button or the app theme) = Standard's night preset; Standard lights the windows of its own buildings.
  const applyConfig = () => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    for (const [k, v] of Object.entries(standardConfig(dark, dusk))) {
      try {
        map.setConfigProperty("basemap", k, v);
      } catch {
        /* a non-Standard style has no basemap import: nothing to configure */
      }
    }
  };
  useEffect(() => {
    if (loaded) applyConfig();
    // applyConfig only reads dark
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark, dusk, loaded]);

  // Our township glass textures (same drawing as the MapLibre map); all night-reveal frames up front.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded) return;
    for (const step of dark ? Array.from({ length: NIGHT_STEPS + 1 }, (_, i) => i) : [0]) {
      const id = idFor(step);
      if (!map.hasImage(id)) map.addImage(id, drawGlassTexture(colors, dark, step / NIGHT_STEPS), { pixelRatio: window.innerWidth < 640 ? 3.5 : 2 });
    }
    // idFor is derived from colors and dark
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, dark, loaded]);

  // Light to dark while open: the windows of our towers come on over about 1.2 s (as on the MapLibre map).
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
    // we only react to a new selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loaded]);

  const wasPaused = useRef(false);
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (wasPaused.current && !paused && map) {
      if (reduced) map.jumpTo(townshipView());
      else map.flyTo({ ...townshipView(), bearing: map.getBearing(), duration: 1200 });
    }
    wasPaused.current = paused;
  }, [paused, reduced]);

  const firstDev = useRef(true);
  useEffect(() => {
    if (!loaded) return;
    const isFirst = firstDev.current;
    firstDev.current = false;
    const map = mapRef.current?.getMap();
    if (isFirst || !map || selectedId) return;
    const target = devId && townshipById[devId] ? devView(devId) : klangView();
    if (reduced) map.jumpTo(target);
    else map.flyTo({ ...target, duration: 2200, essential: false });
    // selectedId has its own fly-in above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devId, loaded]);

  const onClick = (e: MapMouseEvent) => {
    const id = (e as MapMouseEvent & { features?: { properties?: { id?: string } | null }[] }).features?.[0]?.properties?.id;
    if (id) onSelect(id);
  };
  const showTownship = devId === COVE_ID || !!selectedId;
  const from = selectedId ? centres[selectedId] : undefined;
  const poiFit = useNamedPois(() => mapRef.current?.getMap(), loaded && showTownship, from);
  const sel = selectedId ?? "";
  const night = dark ? 0.9 : dusk ? 0.35 : 0; // our towers glow a little at dusk and night, like Standard's own lit windows
  // Same finish on all three tower layers: rounded edges, soft contact shadow (ambient occlusion) on walls and ground, cast shadows.
  const finish = {
    layout: { "fill-extrusion-edge-radius": 0.25 },
    paint: {
      "fill-extrusion-ambient-occlusion-intensity": 0.4,
      "fill-extrusion-ambient-occlusion-wall-radius": 3,
      "fill-extrusion-ambient-occlusion-ground-radius": 6,
      "fill-extrusion-ambient-occlusion-ground-attenuation": 0.5,
      "fill-extrusion-cast-shadows": true,
    },
  } as const;

  const railCasing: LayerProps = {
    id: "homelander-rail-casing",
    type: "line",
    slot: "middle",
    layout: { "line-join": "miter", "line-cap": "square" },
    paint: { "line-color": colors.foreground, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 10], "line-emissive-strength": 1 },
  };
  const rail: LayerProps = {
    id: "homelander-rail",
    type: "line",
    slot: "middle",
    layout: { "line-join": "miter", "line-cap": "square" },
    paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 6], "line-emissive-strength": 1 },
  };
  const stations: LayerProps = {
    id: "homelander-stations",
    type: "circle",
    slot: "top",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 6],
      "circle-color": colors.card,
      "circle-stroke-color": colors.foreground,
      "circle-stroke-width": 2,
      "circle-pitch-alignment": "map",
      "circle-emissive-strength": 1,
    },
  };
  const innerRail: LayerProps = {
    id: "rail",
    type: "line",
    slot: "middle",
    minzoom: 14,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": colors["chart-3"], "line-width": 4, "line-emissive-strength": 1 },
  };
  const towers: LayerProps = {
    id: "township-buildings",
    type: "fill-extrusion",
    slot: "middle",
    minzoom: 14,
    filter: ["!=", ["get", "id"], sel],
    layout: finish.layout,
    paint: {
      ...finish.paint,
      "fill-extrusion-height": ["get", "height"],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 1,
      "fill-extrusion-pattern": glassId,
      "fill-extrusion-emissive-strength": night,
    },
  };
  const roofs: LayerProps = {
    id: "township-roofs",
    type: "fill-extrusion",
    slot: "middle",
    minzoom: 14,
    filter: ["!=", ["get", "id"], sel],
    layout: finish.layout,
    paint: {
      ...finish.paint,
      "fill-extrusion-height": ["+", ["get", "height"], 0.6],
      "fill-extrusion-base": ["get", "height"],
      "fill-extrusion-opacity": 1,
      "fill-extrusion-color": roofColor,
    },
  };
  const selected: LayerProps = {
    id: "township-selected",
    type: "fill-extrusion",
    slot: "middle",
    minzoom: 14,
    filter: ["==", ["get", "id"], sel],
    layout: finish.layout,
    paint: {
      ...finish.paint,
      "fill-extrusion-height": ["get", "height"],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.92,
      "fill-extrusion-color": colors.primary,
      "fill-extrusion-emissive-strength": 0.5,
    },
  };

  return (
    // The Mapbox logo and attribution stay on (licence); on phones they are lifted above the tab bar. Night Market's CSS canvas invert is off.
    <div className="absolute inset-0 [&_.mapboxgl-canvas]:!filter-none max-lg:[&_.mapboxgl-ctrl-bottom-left]:!bottom-[104px] max-lg:[&_.mapboxgl-ctrl-bottom-right]:!bottom-[104px]">
      <Map
        ref={mapRef}
        mapboxAccessToken={TOKEN}
        initialViewState={initialView}
        mapStyle="mapbox://styles/mapbox/standard"
        maxPitch={70}
        minZoom={8.5}
        interactiveLayerIds={["township-buildings", "township-roofs", "township-selected"]}
        cursor="auto"
        onError={(e) => {
          const err = e.error as (Error & { name?: string }) | undefined;
          const aborted = err?.name === "AbortError" || /abort/i.test(err?.message ?? "");
          (aborted ? console.warn : console.error)(err);
        }}
        onClick={onClick}
        onLoad={(e) => {
          onMapReady?.(e.target as unknown as ControlMap);
          setLoaded(true);
        }}
        style={{ width: "100%", height: "100%" }}
      >
        <Source id="homelander-rail" type="geojson" data={railGeoJSON}>
          <Layer {...railCasing} />
          <Layer {...rail} />
        </Source>
        <Source id="homelander-stations" type="geojson" data={stationGeoJSON}>
          <Layer {...stations} />
        </Source>
        <Source id="rail" type="geojson" data={railGeoJson}>
          <Layer {...innerRail} />
        </Source>
        <Source id="buildings" type="geojson" data={buildingsGeoJson}>
          <Layer {...towers} />
          <Layer {...roofs} />
          <Layer {...selected} />
        </Source>
        {!selectedId &&
          towns.map((x) => {
            const phone = !window.matchMedia("(min-width: 1024px)").matches; // ponytail: read at render, no resize listener
            const lean = (phone ? pillLeanPhone : pillLean)[x.t.id] ?? "center";
            return (
              <Marker
                key={x.t.id}
                longitude={x.t.pos.lng}
                latitude={x.t.pos.lat}
                anchor={lean === "left" ? "bottom-right" : lean === "right" ? "bottom-left" : lean === "below" ? "top-left" : "bottom"}
                offset={[(lean === "left" ? 8 : lean === "right" || lean === "below" ? -8 : 0) + (phone ? (pillNudgePhone[x.t.id] ?? 0) : 0), 0]}
                style={{ zIndex: devId === x.t.id ? 3 : 1 }}
              >
                <TownPill info={x} lean={lean} selected={devId === x.t.id} onPick={() => onSelectDev(x.t.id)} />
              </Marker>
            );
          })}
        {!selectedId && (
          <Marker longitude={workAnchor.pos.lng} latitude={workAnchor.pos.lat} anchor="bottom">
            <WorkMarker name={workAnchor.name} />
          </Marker>
        )}
        {showTownship &&
          township.rail.stations.map((s) => (
            <Marker key={s.id} longitude={s.lng} latitude={s.lat} anchor="bottom">
              <Pin id={s.id} d={poiRank(from, s.lng, s.lat)} label={s.name} detail={poiDetail(from, s.lng, s.lat)} Icon={TrainFront} tone="station" named={poiFit.named.has(s.id)} hidden={poiHidden(poiFit, s.id)} />
            </Marker>
          ))}
        {showTownship &&
          township.places.map((p) => (
            <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="bottom">
              <Pin id={p.id} d={poiRank(from, p.lng, p.lat)} label={p.name} detail={poiDetail(from, p.lng, p.lat)} Icon={POI_ICONS[p.kind]} named={poiFit.named.has(p.id)} hidden={poiHidden(poiFit, p.id)} />
            </Marker>
          ))}
      </Map>
    </div>
  );
}
