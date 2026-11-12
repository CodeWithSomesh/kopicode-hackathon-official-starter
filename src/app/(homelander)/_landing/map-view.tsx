"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker as MLMarker } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PixButton, PixPanel, PixTag } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { anchorOptions, railLines, rmShort } from "@/lib/homelander/data";
import { useHomeLander } from "@/lib/homelander/store";
import { cn } from "@/lib/utils";
import {
  mapSprites,
  pillLean,
  railColors,
  railGeoJSON,
  stationGeoJSON,
  townBounds,
  townInfoById,
  towns,
  type TownInfo,
} from "./map-data";
import { TownPanel } from "./town-panel";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const PITCH_3D = 58;
const BEARING = -14;
const TOWN_ZOOM = 14.6;

type Status = "loading" | "ready" | "error";
type MarkerEls = { pills: Record<string, HTMLElement>; anchor: HTMLElement };

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isDesktop = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

/** Keeps the camera clear of the floating header, list, panel, sheet and tab bar. */
function cameraPadding(panelOpen: boolean) {
  if (isDesktop()) return { top: 110, bottom: 60, left: 340, right: panelOpen ? 440 : 110 };
  const h = window.innerHeight;
  return {
    top: 150,
    bottom: panelOpen ? Math.min(h * 0.52, 460) + 150 : 140,
    left: 30,
    right: 70,
  };
}

/** Pull the OpenFreeMap Liberty style toward HomeLander's palette: sky water, soft ground, lilac towers. */
function tintStyle(map: MLMap) {
  const paint = (
    layer: string,
    prop: Parameters<MLMap["setPaintProperty"]>[1],
    value: Parameters<MLMap["setPaintProperty"]>[2],
  ) => {
    try {
      if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
    } catch {
      // A renamed layer in a future style version should not break the map.
    }
  };
  paint("background", "background-color", "#eef7e4");
  paint("water", "fill-color", "#9fd8ff");
  paint("waterway_river", "line-color", "#6cbcf2");
  paint("waterway_other", "line-color", "#6cbcf2");
  paint("park", "fill-color", "#c4ebb2");
  paint("park", "fill-opacity", 0.85);
  paint("landcover_wood", "fill-color", "#b5e3a1");
  paint("landcover_grass", "fill-color", "#cdeebd");
  paint("landuse_residential", "fill-color", "#f6f1e6");
  paint("building", "fill-color", "#e4dcf7");
  paint("natural_earth", "raster-opacity", 0.25);

  // 3D buildings: make sure an extrusion layer exists, start it a zoom earlier, colour by height.
  if (!map.getLayer("building-3d")) {
    map.addLayer({
      id: "building-3d",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 13,
      paint: {
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
      },
    });
  }
  try {
    map.setLayerZoomRange("building-3d", 13, 24);
  } catch {
    // ignore
  }
  paint("building-3d", "fill-extrusion-color", [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "render_height"], 0],
    0,
    "#fbfdff",
    25,
    "#e4dcf7",
    80,
    "#c3b3ff",
    200,
    "#9d89f0",
  ]);
  paint("building-3d", "fill-extrusion-opacity", 0.92);

  // Fewer shop and café icons, so the township pills are the loudest thing on the map.
  for (const id of ["poi_r20", "poi_r7", "poi_r1"]) {
    try {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
    } catch {
      // ignore
    }
  }
}

function addRail(map: MLMap) {
  const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  map.addSource("homelander-rail", { type: "geojson", data: railGeoJSON });
  map.addSource("homelander-stations", { type: "geojson", data: stationGeoJSON });
  map.addLayer(
    {
      id: "homelander-rail-casing",
      type: "line",
      source: "homelander-rail",
      layout: { "line-join": "miter", "line-cap": "square" },
      paint: {
        "line-color": "#2b1d3f",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 14, 10],
      },
    },
    firstSymbol,
  );
  map.addLayer(
    {
      id: "homelander-rail",
      type: "line",
      source: "homelander-rail",
      layout: { "line-join": "miter", "line-cap": "square" },
      paint: {
        "line-color": ["get", "color"],
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 6],
      },
    },
    firstSymbol,
  );
  map.addLayer(
    {
      id: "homelander-stations",
      type: "circle",
      source: "homelander-stations",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 6],
        "circle-color": "#ffffff",
        "circle-stroke-color": "#2b1d3f",
        "circle-stroke-width": 2,
        "circle-pitch-alignment": "map",
      },
    },
    firstSymbol,
  );
}

export function MapView() {
  const s = useHomeLander();
  const anchor = anchorOptions.find((a) => a.id === s.anchorId) ?? anchorOptions[0]!;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const anchorMarkerRef = useRef<MLMarker | null>(null);
  const pillMarkersRef = useRef<Record<string, MLMarker>>({});

  const [status, setStatus] = useState<Status>("loading");
  const [els, setEls] = useState<MarkerEls | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bearing, setBearing] = useState(BEARING);
  const [is3D, setIs3D] = useState(true);
  const [attempt, setAttempt] = useState(0);

  // The anchor position at mount time; later changes are applied by the effect below.
  const anchorPosRef = useRef(anchor.pos);

  /* ---------------------------------------------------------------- map lifecycle (client only) */
  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let map: MLMap | null = null;

    (async () => {
      const container = containerRef.current;
      if (!container) return;

      const canvas = document.createElement("canvas");
      const hasWebGL = !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
      if (!hasWebGL) {
        setStatus("error");
        return;
      }

      let ml: typeof import("maplibre-gl");
      try {
        ml = await import("maplibre-gl");
        // Turbopack can't resolve MapLibre's module worker next to the bundle, so serve a copy from /public.
        ml.setWorkerUrl("/homelander/maplibre/maplibre-gl-worker.mjs");
      } catch {
        if (!cancelled) setStatus("error");
        return;
      }
      if (cancelled) return;

      const [w, south, e, north] = townBounds;
      try {
        map = new ml.Map({
          container,
          style: STYLE_URL,
          center: [(w + e) / 2, (south + north) / 2],
          zoom: 9.6,
          pitch: PITCH_3D,
          bearing: BEARING,
          minZoom: 7.5,
          maxPitch: 70,
          attributionControl: false,
          canvasContextAttributes: { antialias: true },
        });
      } catch {
        setStatus("error");
        return;
      }
      mapRef.current = map;
      const m = map;
      let loaded = false;

      timeout = setTimeout(() => {
        if (!loaded && !cancelled) setStatus("error");
      }, 20_000);

      m.on("error", (ev) => {
        // A missing tile after load is harmless; a failed style or WebGL init before load is not.
        const sourceId = (ev as { sourceId?: string }).sourceId;
        if (!loaded && !sourceId && !cancelled) setStatus("error");
      });
      m.on("webglcontextlost", () => {
        if (!cancelled) setStatus("error");
      });
      m.on("rotate", () => setBearing(m.getBearing()));
      m.on("pitchend", () => setIs3D(m.getPitch() > 10));

      m.on("load", () => {
        if (cancelled) return;
        loaded = true;
        clearTimeout(timeout);
        try {
          tintStyle(m);
          addRail(m);
        } catch {
          // Map still works without the tint or rail overlay.
        }

        const camera = m.cameraForBounds(
          [
            [w, south],
            [e, north],
          ],
          { padding: cameraPadding(false), pitch: PITCH_3D, bearing: BEARING },
        );
        if (camera) m.jumpTo(camera);

        const pills: Record<string, HTMLElement> = {};
        for (const info of towns) {
          const el = document.createElement("div");
          const lean = pillLean[info.t.id] ?? "center";
          pills[info.t.id] = el;
          pillMarkersRef.current[info.t.id] = new ml.Marker({
            element: el,
            anchor: lean === "left" ? "bottom-right" : lean === "right" ? "bottom-left" : "bottom",
            offset: lean === "left" ? [8, 0] : lean === "right" ? [-8, 0] : [0, 0],
          })
            .setLngLat([info.t.pos.lng, info.t.pos.lat])
            .addTo(m);
        }
        const anchorEl = document.createElement("div");
        anchorMarkerRef.current = new ml.Marker({
          element: anchorEl,
          anchor: "bottom",
        })
          .setLngLat([anchorPosRef.current.lng, anchorPosRef.current.lat])
          .addTo(m);

        setEls({ pills, anchor: anchorEl });
        setStatus("ready");
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      map?.remove();
      mapRef.current = null;
      anchorMarkerRef.current = null;
      pillMarkersRef.current = {};
      setEls(null);
    };
  }, [attempt]);

  // Move the work marker when the buyer changes their work anchor in the deck.
  useEffect(() => {
    anchorPosRef.current = anchor.pos;
    anchorMarkerRef.current?.setLngLat([anchor.pos.lng, anchor.pos.lat]);
  }, [anchor.pos]);

  // Keep the picked pill above its neighbours.
  useEffect(() => {
    for (const [id, marker] of Object.entries(pillMarkersRef.current)) {
      marker.getElement().style.zIndex = id === selected ? "3" : "1";
    }
  }, [selected, els]);

  /* ---------------------------------------------------------------- camera actions */
  const pick = useCallback((id: string) => {
    setSelected(id);
    const info = townInfoById[id];
    const m = mapRef.current;
    if (!info || !m) return;
    const opts = {
      center: [info.t.pos.lng, info.t.pos.lat] as [number, number],
      zoom: TOWN_ZOOM,
      pitch: m.getPitch() > 10 ? 60 : 0,
      bearing: BEARING - 6,
      padding: cameraPadding(true),
    };
    if (reducedMotion()) m.jumpTo(opts);
    else m.flyTo({ ...opts, speed: 1.1, curve: 1.5, essential: false });
  }, []);

  const showAll = useCallback(() => {
    setSelected(null);
    const m = mapRef.current;
    if (!m) return;
    const [w, south, e, north] = townBounds;
    const camera = m.cameraForBounds(
      [
        [w, south],
        [e, north],
      ],
      {
        padding: cameraPadding(false),
        pitch: m.getPitch() > 10 ? PITCH_3D : 0,
        bearing: BEARING,
      },
    );
    if (!camera) return;
    if (reducedMotion()) m.jumpTo(camera);
    else m.flyTo({ ...camera, speed: 1.2 });
  }, []);

  const close = useCallback(() => setSelected(null), []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, close]);

  const animate = () => !reducedMotion();
  const zoomIn = () => mapRef.current?.zoomIn({ animate: animate() });
  const zoomOut = () => mapRef.current?.zoomOut({ animate: animate() });
  const north = () => mapRef.current?.resetNorth({ animate: animate() });
  const toggle3D = () => {
    const m = mapRef.current;
    if (!m) return;
    const next = !is3D;
    setIs3D(next);
    m.easeTo({ pitch: next ? PITCH_3D : 0, duration: animate() ? 600 : 0 });
  };

  const info = selected ? townInfoById[selected] : undefined;
  const ready = status === "ready";

  return (
    <div className="fixed inset-0 overflow-hidden bg-sky">
      <h1 className="sr-only lg:hidden">Gamuda Land map</h1>

      {/* The map itself */}
      <div
        ref={containerRef}
        className={cn("!absolute inset-0 h-full w-full", status === "error" && "invisible")}
        role="region"
        aria-label="3D map of Gamuda Land townships in the Klang Valley"
      />

      {/* Pills and the work marker, rendered by React into MapLibre's marker elements */}
      {els &&
        towns.map((t) =>
          els.pills[t.t.id]
            ? createPortal(
                <TownPill info={t} selected={selected === t.t.id} onPick={() => pick(t.t.id)} />,
                els.pills[t.t.id]!,
                t.t.id,
              )
            : null,
        )}
      {els && createPortal(<WorkMarker name={anchor.name} />, els.anchor, "anchor")}

      {/* Loading */}
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <PixPanel className="flex items-center gap-3 px-5 py-4" role="status">
            <Sprite art="pin" scale={3} className="text-raya" />
            <span className="font-pixel text-xl">
              Loading map
              <span aria-hidden className="ml-0.5 inline-block animate-[pix-blink_1s_steps(1)_infinite]">
                _
              </span>
            </span>
          </PixPanel>
        </div>
      )}

      {/* Error fallback: the township list below still works */}
      {status === "error" && (
        <div className="absolute inset-x-4 top-[132px] z-10 mx-auto max-w-md lg:top-1/3">
          <PixPanel className="grid gap-3 p-4" role="alert">
            <h2 className="font-pixel text-xl font-bold">The map didn&apos;t load</h2>
            <p className="text-sm leading-relaxed">
              Your browser may have 3D graphics (WebGL) switched off, or the map tiles are offline. You can still pick a
              township from the list to see its homes.
            </p>
            <div>
              <PixButton
                size="sm"
                onClick={() => {
                  setStatus("loading");
                  setAttempt((n) => n + 1);
                }}
              >
                Try again
              </PixButton>
            </div>
          </PixPanel>
        </div>
      )}

      {/* Desktop: township list, left floating panel */}
      <PixPanel className="absolute top-[92px] left-6 z-10 hidden max-h-[calc(100svh-140px)] w-72 flex-col lg:flex">
        <div className="grid gap-1.5 border-b-[3px] border-ink p-3">
          <h1 className="font-pixel text-xl leading-tight font-bold">Gamuda Land map</h1>
          <p className="text-sm leading-snug text-ink-soft">
            Seven townships around the Klang Valley. Pick one to see what&apos;s still up for grabs.
          </p>
          <div>
            <PixTag tone="kaya">Sample data</PixTag>
          </div>
        </div>
        <ul className="grid min-h-0 flex-1 gap-1 overflow-y-auto p-2">
          <li>
            <button
              type="button"
              onClick={showAll}
              disabled={!ready}
              className={cn(
                "flex w-full items-center gap-2 px-2 py-2 text-left font-pixel text-sm hover:bg-sky/40 disabled:opacity-50",
                !selected && "bg-cloud",
              )}
            >
              <Sprite art="pin" scale={2} className="text-ink-soft" />
              Show all townships
            </button>
          </li>
          {towns.map((x) => (
            <li key={x.t.id}>
              <button
                type="button"
                onClick={() => pick(x.t.id)}
                aria-pressed={selected === x.t.id}
                className={cn(
                  "flex w-full items-center gap-2.5 px-2 py-2 text-left transition-colors",
                  selected === x.t.id ? "bg-kaya" : "hover:bg-sky/40",
                )}
              >
                <Sprite
                  art="house"
                  scale={2}
                  className={x.left ? "shrink-0 text-pandan-deep" : "shrink-0 text-ink-soft"}
                />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-pixel text-base leading-tight font-bold">{x.t.name}</span>
                  <span className="truncate text-xs text-ink-soft">{x.t.area}</span>
                </span>
                <span className="grid shrink-0 justify-items-end gap-0.5">
                  <span className="font-pixel text-sm leading-none tabular-nums">{rmShort(x.from)}</span>
                  <span className="font-pixel-label text-[10px] leading-none uppercase">{x.left} left</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Legend anchorName={anchor.name} />
      </PixPanel>

      {/* Phones: township chips under the header */}
      <nav
        aria-label="Townships"
        className="absolute inset-x-0 top-[68px] z-10 flex gap-3 overflow-x-auto px-4 pt-2 pb-4 [scrollbar-width:none] lg:hidden"
      >
        <PixButton
          size="sm"
          className="shrink-0"
          onClick={showAll}
          disabled={!ready}
          tone={selected ? "white" : "kaya"}
        >
          All
        </PixButton>
        {towns.map((x) => (
          <PixButton
            key={x.t.id}
            size="sm"
            className="shrink-0 whitespace-nowrap"
            tone={selected === x.t.id ? "kaya" : "white"}
            aria-pressed={selected === x.t.id}
            onClick={() => pick(x.t.id)}
          >
            {x.t.name}
            <span className="font-pixel-label text-[10px] uppercase">{rmShort(x.from)}</span>
          </PixButton>
        ))}
      </nav>

      {/* Map controls */}
      {ready && (
        <div
          className={cn(
            "absolute top-[136px] right-4 z-10 grid gap-3",
            "lg:top-[92px]",
            info ? "lg:right-[436px]" : "lg:right-6",
          )}
        >
          <PixButton size="sm" className="size-10 px-0" onClick={zoomIn} aria-label="Zoom in">
            <Sprite art={mapSprites.plus} scale={3} />
          </PixButton>
          <PixButton size="sm" className="size-10 px-0" onClick={zoomOut} aria-label="Zoom out">
            <Sprite art={mapSprites.minus} scale={3} />
          </PixButton>
          <PixButton size="sm" className="size-10 px-0" onClick={north} aria-label="Point the map north">
            <Sprite art={mapSprites.needle} scale={2} style={{ transform: `rotate(${-bearing}deg)` }} />
          </PixButton>
          <PixButton
            size="sm"
            className="size-10 px-0 text-sm"
            onClick={toggle3D}
            aria-label={is3D ? "Switch to flat 2D view" : "Switch to tilted 3D view"}
          >
            {is3D ? "2D" : "3D"}
          </PixButton>
        </div>
      )}

      {/* Township panel */}
      {info && <TownPanel key={info.t.id} info={info} anchor={anchor} onClose={close} />}

      {/* Attribution: always visible (above the tab bar on phones) */}
      <div className="absolute right-3 bottom-[104px] z-10 bg-white/90 px-1.5 py-0.5 text-[10px] leading-tight text-ink lg:right-2 lg:bottom-2">
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="underline">
          OpenFreeMap
        </a>{" "}
        <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer" className="underline">
          &copy; OpenMapTiles
        </a>{" "}
        Data from{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
          &copy; OpenStreetMap
        </a>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function TownPill({ info, selected, onPick }: { info: TownInfo; selected: boolean; onPick: () => void }) {
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
        className={cn(
          "mt-[3px] text-ink",
          lean === "left" ? "self-end" : lean === "right" ? "self-start" : "self-center",
        )}
      />
    </div>
  );
}

function WorkMarker({ name }: { name: string }) {
  return (
    <div className="pointer-events-none flex flex-col items-center" aria-label={`Your work: ${name}`} role="img">
      <div
        className="pix-frame flex items-center gap-1.5 px-1.5 py-1"
        style={
          {
            "--pix-fill": "var(--color-lilac)",
            "--pix-drop": "3px",
          } as React.CSSProperties
        }
      >
        <Sprite art={mapSprites.office} scale={2} className="text-ink" />
        <span className="font-pixel-label text-[9px] leading-none uppercase">Work</span>
      </div>
      <Sprite art={mapSprites.tail} scale={2} className="mt-[3px] text-ink" />
    </div>
  );
}

function Legend({ anchorName }: { anchorName: string }) {
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
        Your work: {anchorName}
      </span>
      <span className="text-ink-soft">Rail drawn station to station; commute times are estimates.</span>
      <Sprite
        art="kopi"
        scale={1.5}
        className="absolute right-2 bottom-2 opacity-80"
        label="A kopi, hidden in the corner"
      />
    </div>
  );
}
