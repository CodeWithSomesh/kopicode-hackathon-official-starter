"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { addProtocol, setWorkerUrl, type ExpressionSpecification, type LayerSpecification, type Map as MLMap, type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { gsap } from "gsap";
import { layers as basemapLayers, namedFlavor } from "@protomaps/basemaps";
import { township } from "@/lib/first-key/township";
import { centroid } from "@/lib/first-key/geo";
import { Pin, POI_ICONS, poiDetail, poiHidden, poiRank, TrainFront, useNamedPois } from "./poi-pin";
import { anchorOptions, townshipById } from "@/lib/homelander/data";
import { useHomeLander } from "@/lib/homelander/store";
import { pillLean, pillLeanPhone, pillNudgePhone, railGeoJSON, stationGeoJSON, towns } from "@/app/(homelander)/_landing/map-data";
import { TownPill, WorkMarker } from "@/app/(homelander)/_landing/town-pill";
import { useMapColors } from "../use-map-colors";
import { drawGlassTexture, mix } from "./glass-texture";
import { usePrefersReducedMotion } from "../use-reduced-motion";

// Turbopack can't resolve MapLibre's module worker next to the bundle, so it is served from /public (a copy of
// node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs; re-copy it if MapLibre is upgraded). The only worker setup in the app.
setWorkerUrl("/homelander/maplibre/maplibre-gl-worker.mjs");

// No PMTiles file configured (or it can't be fetched): OpenFreeMap's free Liberty style, no key, with our layers on top.
const LIBERTY_URL = "https://tiles.openfreemap.org/styles/liberty";

const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL; // our own basemap file; unset = plain background
// The file covers 101.35-101.85 E, 2.75-3.40 N; a viewer can pan 0.6 degrees past it (Liberty paints the rest), not further.
const PMTILES_BOUNDS: [number, number, number, number] = [100.75, 2.15, 102.45, 4.0];
let registered = false;
const NIGHT_STEPS = 5;

type Flavor = ReturnType<typeof namedFlavor>;

/** Repaint one OpenFreeMap (Liberty) layer in our Protomaps flavour. Fills always; lines, labels and 3D only at night. */
function recolor(l: LayerSpecification, f: Flavor, dark: boolean, id = l.id): LayerSpecification {
  const sl = "source-layer" in l ? l["source-layer"] : undefined;
  const p = ("paint" in l ? l.paint : {}) as Record<string, unknown>;
  if (l.type === "fill") {
    const c = sl === "water" ? f.water : sl === "landcover" || sl === "park" ? f.park_a : f.earth;
    return { ...l, id, paint: { ...p, "fill-color": c } };
  }
  if (!dark) return { ...l, id };
  if (l.type === "line") return { ...l, id, paint: { ...p, "line-color": sl === "water" || sl === "waterway" ? f.water : sl === "boundary" ? f.boundaries : f.minor_a } };
  if (l.type === "symbol") return { ...l, id, paint: { ...p, "text-color": f.city_label, "text-halo-color": f.city_label_halo } };
  if (l.type === "fill-extrusion") return { ...l, id, paint: { ...p, "fill-extrusion-color": f.buildings } };
  if (l.type === "background") return { ...l, id, paint: { ...p, "background-color": f.earth } };
  return { ...l, id };
}

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
const M_PER_PX_Z0 = 78_271.5 * Math.cos((township.center[1] * Math.PI) / 180); // MapLibre 512px tiles
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
  /** The 3D building is showing over the map: stop the opening shot and any camera motion. */
  paused: boolean;
  /** The camera finished flying to the selected building (or it was already there). */
  onArrived: () => void;
  /** Start already at the selected building, no fly-in (a `?building=` link). */
  startAtSelected?: boolean;
  /** The focused township (a pill was clicked, or a `?dev=` link). Undefined = the Klang Valley overview. */
  devId?: string;
  onSelectDev: (id: string) => void;
  /** The MapLibre map, once it has loaded (for the zoom / compass / 2D-3D buttons). */
  onMapReady?: (map: MLMap) => void;
};

export default function NeighbourhoodMap({ selectedId, onSelect, paused, onArrived, startAtSelected, devId, onSelectDev, onMapReady }: Props) {
  const hl = useHomeLander();
  const workAnchor = anchorOptions.find((a) => a.id === hl.anchorId) ?? anchorOptions[0]!;
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
    const o = startAtSelected ? townshipView() : devId && townshipById[devId] ? devView(devId) : klangView();
    return { longitude: o.center[0], latitude: o.center[1], zoom: o.zoom, pitch: o.pitch, bearing: o.bearing, padding: o.padding };
  });
  const reduced = usePrefersReducedMotion();
  // Night: the Night toggle, or the app theme; colours follow (see use-map-colors.ts). The burst reads the same hook.
  const { colors, dark } = useMapColors();
  // Without our PMTiles file, fetch OpenFreeMap's Liberty style once ("failed" = offline: plain background, never blank).
  const [liberty, setLiberty] = useState<StyleSpecification | "loading" | "failed">("loading");
  useEffect(() => {
    const ctl = new AbortController();
    fetch(LIBERTY_URL, { signal: ctl.signal })
      .then((r) => r.json())
      .then((j: StyleSpecification) => setLiberty(j))
      .catch((e) => e?.name !== "AbortError" && setLiberty("failed"));
    return () => ctl.abort();
  }, []);
  // Mount the map once its basemap style is known: one style set at load.
  const ready = protocolReady && liberty !== "loading";
  const libertyStyle = !withBasemap && typeof liberty === "object" ? liberty : undefined;
  // With our PMTiles file the file only covers the Klang Valley, and a wide screen shows past its edge. Underneath it we paint
  // Liberty's flat layers (land, water, roads: no labels, icons or 3D, so no sprite is needed); the file's own opaque earth covers them inside.
  const underlay = withBasemap && typeof liberty === "object" ? liberty : undefined;

  // Night reveal: when the theme flips light to dark while open, `lit` runs 0..NIGHT_STEPS and the windows come on.
  const [lit, setLit] = useState(NIGHT_STEPS);
  // the id carries the colours (so any theme gets its own texture) and, in dark, the night-reveal step
  const idFor = (step: number) =>
    `glass-${dark ? "d" : "l"}-${colors["chart-3"]}-${colors.background}-${colors.primary}-${colors.foreground}${dark ? `-L${step}` : ""}`;
  const glassId = idFor(lit);
  // The real neighbourhood: plain massing, no texture (a repeating window pattern read as bathroom tiles on walls and roofs and
  // shimmered as the camera moved). Soft tone by height, walls shaded against roofs by the vertical gradient. Only OUR towers carry windows.
  const roofColor = dark ? mix(colors.background, colors.foreground, 0.3) : mix(colors.foreground, colors.background, 0.72);
  // Protomaps layers for the theme, with its flat `buildings` fill swapped for plain extrusions. Height from the data, else 6 m.
  // Only `building` outlines are drawn: a `building_part` shares its walls with the outline (both start at the ground), so
  // drawing both put two coplanar faces in the same place and they z-fought (flicker) as the camera moved.
  const basemap = useMemo<LayerSpecification[]>(() => {
    const base = mix(colors.muted, dark ? colors.background : colors.card, dark ? 0.4 : 0.55);
    const tones = [base, mix(base, colors["chart-3"], dark ? 0.12 : 0.1), mix(base, colors["chart-3"], dark ? 0.24 : 0.22)];
    const heightOf: ExpressionSpecification = ["coalesce", ["to-number", ["get", "height"], 0], 6];
    return [
      ...basemapLayers("protomaps", namedFlavor(dark ? "dark" : "light"), { lang: "en" }).filter((l) => l.id !== "buildings" && l.id !== "background"), // its grey background would show outside the file
      {
        id: "basemap-buildings",
        type: "fill-extrusion",
        source: "protomaps",
        "source-layer": "buildings",
        minzoom: 14,
        filter: ["==", ["get", "kind"], "building"],
        paint: {
          "fill-extrusion-height": heightOf,
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": true,
          "fill-extrusion-color": ["interpolate", ["linear"], heightOf, 6, tones[0], 40, tones[1], 120, tones[2]],
        },
      },
    ];
  }, [dark, colors]);
  const style = useMemo<StyleSpecification>(() => {
    const flavor = namedFlavor(dark ? "dark" : "light");
    const overlays: LayerSpecification[] = [
      {
        id: "homelander-rail-casing",
        type: "line",
        source: "homelander-rail",
        layout: { "line-join": "miter", "line-cap": "square" },
        paint: { "line-color": colors.foreground, "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 10] },
      },
      {
        id: "homelander-rail",
        type: "line",
        source: "homelander-rail",
        layout: { "line-join": "miter", "line-cap": "square" },
        paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 6] },
      },
      {
        id: "homelander-stations",
        type: "circle",
        source: "homelander-stations",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 6],
          "circle-color": colors.card,
          "circle-stroke-color": colors.foreground,
          "circle-stroke-width": 2,
          "circle-pitch-alignment": "map",
        },
      },
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
        // Plain roof cap: the window pattern would otherwise wrap over the roofs. 0.6 m slab in a flat roof colour.
        id: "township-roofs",
        type: "fill-extrusion",
        source: "buildings",
        minzoom: 14,
        filter: ["!=", ["get", "id"], selectedId ?? ""],
        paint: {
          "fill-extrusion-height": ["+", ["get", "height"], 0.6],
          "fill-extrusion-base": ["get", "height"],
          "fill-extrusion-opacity": 1,
          "fill-extrusion-color": roofColor,
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
    ];
    const ours = {
      buildings: { type: "geojson" as const, data: buildingsGeoJson },
      rail: { type: "geojson" as const, data: railGeoJson },
      "homelander-rail": { type: "geojson" as const, data: railGeoJSON },
      "homelander-stations": { type: "geojson" as const, data: stationGeoJSON },
    };
    if (libertyStyle) {
      const base = dark ? libertyStyle.layers.filter((l) => l.type !== "raster").map((l) => recolor(l, flavor, true)) : libertyStyle.layers;
      return { ...libertyStyle, sources: { ...libertyStyle.sources, ...ours }, layers: [...base, ...overlays] };
    }
    return {
      version: 8,
      glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
      sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${dark ? "dark" : "light"}`,
      sources: {
        ...underlay?.sources,
        ...(withBasemap && {
          protomaps: {
            type: "vector" as const,
            url: `pmtiles://${new URL(PMTILES_URL!, window.location.origin).href}`,
            attribution: '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        }),
        ...ours,
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": underlay ? flavor.earth : colors.background } },
        ...(underlay?.layers
          .filter((l) => l.type !== "symbol" && l.type !== "fill-extrusion" && l.type !== "raster" && l.type !== "background" && !JSON.stringify("paint" in l ? l.paint : {}).includes("pattern"))
          .map((l) => recolor(l, flavor, dark, `ol-${l.id}`)) ?? []),
        ...(withBasemap ? basemap : []),
        ...overlays,
      ],
    };
  }, [colors, dark, selectedId, glassId, roofColor, withBasemap, basemap, libertyStyle, underlay]);

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
    const target = devId && townshipById[devId] ? devView(devId) : klangView();
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


  const from = selectedId ? centres[selectedId] : undefined;
  const poiFit = useNamedPois(() => mapRef.current?.getMap(), loaded && showTownship, from);

  return (
    // Night Market's themes.css inverts the map canvas with a CSS filter (it assumed one light basemap). We draw a real night map, so switch it off here.
    <div className="absolute inset-0 [&_.maplibregl-canvas]:!filter-none">
      {ready && (
      <Map
        ref={mapRef}
        pixelRatio={pixelRatio}
        initialViewState={initialView}
        mapStyle={style}
        maxPitch={70}
        minZoom={8.5}
        maxBounds={withBasemap ? PMTILES_BOUNDS : undefined}
        interactiveLayerIds={["township-buildings", "township-roofs", "township-selected"]}
        cursor="auto"
        onError={(e) => {
          // Only a request that was really aborted (the view moved on) is quiet. Everything else stays loud, most of
          // all a failed fetch of the PMTiles file (wrong URL, CORS on a cross-origin host).
          const err = e.error as (Error & { name?: string }) | undefined;
          const aborted = err?.name === "AbortError" || /abort/i.test(err?.message ?? "");
          (aborted ? console.warn : console.error)(err);
        }}
        onClick={onClick}
        onLoad={(e) => {
          onMapReady?.(e.target as MLMap);
          setLoaded(true);
        }}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
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
      )}
    </div>
  );
}
