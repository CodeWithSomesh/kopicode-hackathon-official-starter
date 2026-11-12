import type { LngLat } from "@/lib/first-key/types";
import { enclave, groups, houses } from "@/lib/first-key/landed";
import type { ThemeColors } from "../use-theme-colors";
import * as THREE from "three";

const mix = (a: string, b: string, t: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

/**
 * The enclave's flat ground and invisible/plain house volumes as plain GeoJSON sources with plain style layers, shared by the
 * Mapbox map (houses are an invisible picking volume on top of the glTF models) and the MapLibre map (houses are the
 * visible plain extrusions). Each map adds its own extras (Mapbox: `slot` and `*-emissive-strength`).
 */

type Fc = { type: "FeatureCollection"; features: { type: "Feature"; properties: Record<string, unknown>; geometry: { type: "Polygon"; coordinates: LngLat[][] } | { type: "LineString"; coordinates: LngLat[] } }[] };
const poly = (ring: LngLat[], properties: Record<string, unknown> = {}) => ({ type: "Feature" as const, properties, geometry: { type: "Polygon" as const, coordinates: [ring] } });
const fc = (features: Fc["features"]): Fc => ({ type: "FeatureCollection", features });

export type LandedLayer = { id: string; type: "fill" | "line" | "fill-extrusion"; filter?: unknown[]; paint: Record<string, unknown> };
export type LandedSource = { id: string; data: Fc; layers: LandedLayer[] };

// metres to pixels: at zoom z one metre is 2^z / 78,200 pixels here (512 px tiles, latitude 2.9), so exponential base 2 between two zooms is exact
const metres = (m: number) => ["interpolate", ["exponential", 2], ["zoom"], 14, (m * 2 ** 14) / 78_200, 21, (m * 2 ** 21) / 78_200];

/** `picking`: true on Mapbox, where the glTF models are the visible houses and the extrusions are a near-invisible click target. */
export function landedSources(colors: ThemeColors, dark: boolean, sel: string, picking: boolean): LandedSource[] {
  const grass = mix("#7fb06f", colors.background, dark ? 0.7 : 0.25);
  const lawn = mix("#a8cf8f", colors.background, dark ? 0.7 : 0.35);
  const water = dark ? "#1d5f78" : "#5cb8d0";
  const road = dark ? "#5a5d63" : "#8f8f8a";
  const wall = dark ? "#8a8076" : mix(colors.muted, "#f1e8da", 0.55);
  const parks = enclave.parks.filter((p) => !("water" in p));
  const lakes = enclave.parks.filter((p) => "water" in p);
  const hid = (o: number) => (picking ? 0.01 : o);
  return [
    {
      id: "enclave-ground",
      data: fc([
        poly(enclave.ring, { k: "park" }),
        ...parks.map((p) => poly(p.ring, { k: "park" })),
        ...houses.map((h) => poly(h.plot, { k: "plot" })),
        ...lakes.map((p) => poly(p.ring, { k: "lake" })),
        ...enclave.pools.map((p) => poly(p.ring, { k: "lake" })),
        poly(enclave.clubhouse.deck, { k: "deck" }),
      ]),
      layers: [
        { id: "enclave-park", type: "fill", filter: ["==", ["get", "k"], "park"], paint: { "fill-color": grass, "fill-opacity": 0.95 } },
        { id: "enclave-plot", type: "fill", filter: ["==", ["get", "k"], "plot"], paint: { "fill-color": lawn, "fill-opacity": 1 } },
        { id: "enclave-lake", type: "fill", filter: ["==", ["get", "k"], "lake"], paint: { "fill-color": water, "fill-opacity": 0.95 } },
        { id: "enclave-deck", type: "fill", filter: ["==", ["get", "k"], "deck"], paint: { "fill-color": dark ? "#4a4640" : "#e9dfcf", "fill-opacity": picking ? 0 : 1 } },
      ],
    },
    {
      id: "enclave-streets",
      data: fc(enclave.streets.map((s) => ({ type: "Feature" as const, properties: { w: s.width }, geometry: { type: "LineString" as const, coordinates: s.path } }))),
      layers: [{ id: "enclave-road", type: "line", paint: { "line-color": road, "line-width": metres(6) } }],
    },
    {
      id: "enclave-gate",
      data: fc(enclave.gate.guardhouses.map((r) => poly(r, { h: 3.2 }))),
      layers: [{ id: "enclave-guardhouse", type: "fill-extrusion", paint: { "fill-extrusion-color": dark ? "#9b4a3e" : "#c0563f", "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0 } }],
    },
    {
      id: "enclave-houses",
      data: fc(houses.map((h) => poly(h.footprint, { id: h.id, height: h.heightM, group: h.group }))),
      layers: [
        { id: "landed-houses", type: "fill-extrusion", filter: ["!=", ["get", "id"], sel], paint: { "fill-extrusion-color": wall, "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": 0, "fill-extrusion-opacity": hid(1) } },
        { id: "landed-selected", type: "fill-extrusion", filter: ["==", ["get", "id"], sel], paint: { "fill-extrusion-color": colors.primary, "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.9 } },
      ],
    },
    {
      id: "enclave-club",
      data: fc([poly(enclave.clubhouse.footprint, { h: enclave.clubhouse.h })]),
      layers: [{ id: "landed-club", type: "fill-extrusion", paint: { "fill-extrusion-color": wall, "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": picking ? 0 : 1 } }],
    },
  ];
}

/** The ids a click on the map can return for a house (the extrusion layers). */
export const LANDED_PICK_LAYERS = ["landed-houses", "landed-selected"];

/** Building groups as points for Mapbox's model layer: one glb per variant, at the centre of the group's footprint. */
export const groupPoints = (variantOf: (variant: string) => string, rot: 0 | 180) => ({
  type: "FeatureCollection" as const,
  features: [...groups, { id: "club", variant: enclave.clubhouse.variant, rot: 0, lng: enclave.clubhouse.centre[0], lat: enclave.clubhouse.centre[1], w: enclave.clubhouse.w, d: enclave.clubhouse.d }]
    .filter((g) => g.rot === rot)
    .map((g) => ({ type: "Feature" as const, properties: { id: g.id, model: variantOf(g.variant) }, geometry: { type: "Point" as const, coordinates: [g.lng, g.lat] } })),
});
