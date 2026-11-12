"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Marker, Source, useMap } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import { siteLayout } from "@/lib/first-key/site-layout";
import type { ThemeColors } from "../use-theme-colors";
import { SITE_MIN_ZOOM, SiteChip, siteFootprints, siteLabels, typeFill, useZoomGate } from "./site-shared";

// Illustrative buildings at the Gamuda sites on the Mapbox map (layout: site-layout.json, models: tower/variants.ts).
// Per site in view only: one glb per variant is built lazily and cached per day/night; a variant that fails to build is drawn
// as a flat-coloured extrusion instead. Models cast no shadows. Clicks go through the flat footprints (and the model/box layers
// if Mapbox answers for them): every feature carries `site`, the township id. Design and numbers: RESEARCH-site-buildings-tech.md.

// ---- STUB: the models lane's builder is not in yet. When tower/variants.ts lands, delete this block and add
//   import { variantGlb } from "../tower/variants";
// A rejected build means "draw the extrusion stand-in for this variant".
const variantGlb = (key: string, colors: ThemeColors, night: boolean): Promise<string> => {
  void colors;
  void night;
  return Promise.reject(new Error(`no model builder yet for ${key}`));
};
// ---- END STUB

export const SITE_CLICK_IDS = ["site-models", "site-boxes", "site-footprints"];

const BUILDINGS = siteLayout.buildings;
const BY_SITE = new Map<string, typeof BUILDINGS>();
for (const b of BUILDINGS) BY_SITE.set(b.site, [...(BY_SITE.get(b.site) ?? []), b]);

const modelId = (variant: string, night: boolean) => `site-${variant}-${night ? "n" : "d"}`;

export default function SiteBuildings({ colors, dark, dusk }: { colors: ThemeColors; dark: boolean; dusk: boolean }) {
  const { current } = useMap();
  const map = current?.getMap();
  const zoomed = useZoomGate(() => map, !!map);
  const [visible, setVisible] = useState(""); // ids of the sites in view, sorted and comma-joined
  const [ready, setReady] = useState<ReadonlySet<string>>(new Set()); // model ids added to the style
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set()); // variants drawn as stand-in extrusions
  const builds = useRef(new Map<string, Promise<void>>());

  // Which sites are on screen (projected, so pitch is handled), only while zoomed in far enough to draw anything.
  useEffect(() => {
    if (!map) return;
    const refresh = () => {
      if (map.getZoom() < SITE_MIN_ZOOM) return setVisible("");
      const { clientWidth: w, clientHeight: h } = map.getCanvas();
      const m = 250;
      const ids: string[] = [];
      for (const [site, bs] of BY_SITE) {
        const hit = bs.some((b) => {
          const p = map.project([b.lng, b.lat]);
          return p.x > -m && p.x < w + m && p.y > -m && p.y < h + m;
        });
        if (hit) ids.push(site);
      }
      setVisible(ids.sort().join(","));
    };
    let last = 0;
    const onMove = () => {
      const now = performance.now();
      if (now - last > 300) {
        last = now;
        refresh();
      }
    };
    refresh();
    map.on("move", onMove);
    map.on("moveend", refresh);
    return () => {
      map.off("move", onMove);
      map.off("moveend", refresh);
    };
  }, [map]);

  // Build the glbs of the sites in view, one variant at a time (yielding in between), once per variant and day/night.
  // ponytail: the cache key is variant + night, so a colour change within the same mode keeps the old glb.
  useEffect(() => {
    if (!map || !visible) return;
    let dead = false;
    const keys = [...new Set(visible.split(",").flatMap((s) => BY_SITE.get(s)!.map((b) => b.variant)))];
    (async () => {
      for (const key of keys) {
        if (dead) return;
        const id = modelId(key, dark);
        let p = builds.current.get(id);
        if (!p) {
          p = variantGlb(key, colors, dark).then(
            (url) => {
              map.addModel(id, url);
              setTimeout(() => URL.revokeObjectURL(url), 5000);
              setReady((s) => new Set(s).add(id));
            },
            () => setFailed((s) => new Set(s).add(key)),
          );
          builds.current.set(id, p);
        }
        await p;
        await new Promise((r) => setTimeout(r, 0));
      }
    })();
    return () => {
      dead = true;
    };
  }, [map, visible, dark, colors]);

  const modelPoints = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: BUILDINGS.filter((b) => ready.has(modelId(b.variant, dark))).map((b) => ({
        type: "Feature" as const,
        properties: { site: b.site, model: modelId(b.variant, dark), rotation: [0, 0, b.rot] },
        geometry: { type: "Point" as const, coordinates: [b.lng, b.lat] },
      })),
    }),
    [ready, dark],
  );

  const night = dark ? 0.9 : dusk ? 0.35 : 0;
  const models = {
    id: "site-models",
    type: "model",
    slot: "middle",
    minzoom: SITE_MIN_ZOOM,
    layout: { "model-id": ["get", "model"] },
    paint: {
      "model-type": "common-3d",
      "model-scale": [1, 1, 1],
      "model-rotation": ["get", "rotation"],
      "model-cast-shadows": false,
      "model-receive-shadows": true,
      "model-emissive-strength": night,
    },
  } as unknown as LayerProps;
  const boxes = {
    id: "site-boxes",
    type: "fill-extrusion",
    slot: "middle",
    minzoom: SITE_MIN_ZOOM,
    filter: failed.size ? ["in", ["get", "variant"], ["literal", [...failed]]] : ["==", ["get", "variant"], "__none"],
    paint: {
      "fill-extrusion-height": ["get", "h"],
      "fill-extrusion-base": 0,
      "fill-extrusion-color": typeFill(colors),
      "fill-extrusion-opacity": 0.95,
      "fill-extrusion-cast-shadows": false,
      "fill-extrusion-emissive-strength": night,
    },
  } as unknown as LayerProps;
  const footprints: LayerProps = {
    id: "site-footprints",
    type: "fill",
    slot: "middle",
    minzoom: SITE_MIN_ZOOM,
    paint: { "fill-color": colors.primary, "fill-opacity": 0.14, "fill-emissive-strength": 1 },
  };

  return (
    <>
      <Source id="site-footprints" type="geojson" data={siteFootprints}>
        <Layer {...footprints} />
        <Layer {...boxes} />
      </Source>
      <Source id="site-models" type="geojson" data={modelPoints}>
        <Layer {...models} />
      </Source>
      {zoomed &&
        siteLabels.map((l) => (
          <Marker key={l.site} longitude={l.lng} latitude={l.lat} anchor="bottom" offset={[0, -8]} style={{ pointerEvents: "none", zIndex: 0 }}>
            <SiteChip />
          </Marker>
        ))}
    </>
  );
}
