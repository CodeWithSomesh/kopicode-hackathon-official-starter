"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/homelander/i18n/client";
import { parseVariant, siteKind, siteLayout, type SiteBuilding } from "@/lib/first-key/site-layout";
import type { ThemeColors } from "../use-theme-colors";

// Shared by the Mapbox (site-buildings.tsx) and the MapLibre (neighbourhood-map.tsx) map: the spawned site buildings'
// footprints, their type colours, the zoom gate and the "illustrative" chip. No map library is imported here.

/** Spawned buildings, their footprints and the chips only exist from this zoom up (the model layer costs per building in view). */
export const SITE_MIN_ZOOM = 14.5;

const M_LAT = 110_574;

/** Where to look for a site: centre of its spawned buildings and the zoom that fits them (clamped so they are always drawn, SITE_MIN_ZOOM..16.5). */
export function siteFit(site: string, freePx: number): { center: [number, number]; zoom: number } | null {
  const bs = siteLayout.buildings.filter((b) => b.site === site);
  if (!bs.length) return null;
  const lngs = bs.map((b) => b.lng), lats = bs.map((b) => b.lat);
  const [w, e, s, n] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
  const lat = (s + n) / 2;
  const spanM = Math.max(120, (e - w) * 111_320 * Math.cos((lat * Math.PI) / 180), (n - s) * M_LAT);
  const zoom = Math.log2((freePx * 0.8 * 78_271.5 * Math.cos((lat * Math.PI) / 180)) / spanM);
  return { center: [(w + e) / 2, lat], zoom: Math.min(16.5, Math.max(SITE_MIN_ZOOM + 0.1, zoom)) };
}
/** The model's w axis points east (bearing 90) at model-rotation 0: MODEL_W_BEARING in tower/variants.ts (not imported, it pulls in three). */
export const W_BEARING = 90;

/** The building's rectangle as a closed ring. w runs along the row at bearing `rot` (degrees clockwise from north), d across it. */
function ring(b: SiteBuilding): [number, number][] {
  const kx = 111_320 * Math.cos((b.lat * Math.PI) / 180);
  const t = ((b.rot - W_BEARING) * Math.PI) / 180; // the same turn the model gets: footprint and model agree by construction
  const s = Math.sin(t);
  const c = Math.cos(t);
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]] as const).map(([i, j]) => {
    const x = (i * b.w) / 2; // east
    const y = (j * b.d) / 2; // north
    return [b.lng + (x * c + y * s) / kx, b.lat + (-x * s + y * c) / M_LAT];
  });
}

function typeOf(variant: string): string {
  try {
    return parseVariant(variant).type;
  } catch {
    return "terrace";
  }
}

/** `sid` on the buildings that open up (towers and landed homes): "sb<n>", n = index in site-layout.json. */
export const sidOf = (b: SiteBuilding, i: number) => (siteKind(b) ? { sid: `sb${i}` } : {});

/** One rectangle per building: click target and stand-in extrusion on Mapbox, the building itself on MapLibre. */
export const siteFootprints = {
  type: "FeatureCollection" as const,
  features: siteLayout.buildings.map((b, i) => ({
    type: "Feature" as const,
    properties: { site: b.site, variant: b.variant, type: typeOf(b.variant), h: b.h, ...sidOf(b, i) },
    geometry: { type: "Polygon" as const, coordinates: [ring(b)] },
  })),
};

/** Flat colour by typology, from the theme tokens: landed, semi-D/bungalow, shops/offices, towers, clubhouse. */
export const typeFill = (c: ThemeColors): unknown[] => [
  "match", ["get", "type"],
  ["terrace", "superlink", "link", "townhouse", "cluster"], c["chart-3"],
  ["semid", "bungalow"], c["chart-2"],
  ["shoplot", "office", "mall"], c.primary,
  "tower", c["chart-1"],
  c["chart-4"],
];

type Zoomable = { getZoom(): number; on(t: "zoom", f: () => void): unknown; off(t: "zoom", f: () => void): unknown };
/** True while the map is zoomed in to SITE_MIN_ZOOM or more. Re-renders only when it flips. `get` returns the map (read in an effect). */
export function useZoomGate(get: () => unknown, enabled: boolean): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const m = get() as Zoomable | undefined;
    if (!m || !enabled) return;
    const f = () => setOn(m.getZoom() >= SITE_MIN_ZOOM);
    f();
    m.on("zoom", f);
    return () => void m.off("zoom", f);
    // get is a closure over a ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return on;
}

/** The honesty chip: Kopitiam pixel style like the township pills, never clickable. */
export function SiteChip() {
  const t = useT();
  return (
    <div
      className="pix-frame pointer-events-none max-w-[170px] px-1.5 py-1 text-center font-pixel-label text-[10px] leading-tight uppercase text-ink max-lg:text-[9px] lg:max-w-none lg:whitespace-nowrap"
      style={{ "--pix-fill": "var(--color-cloud)", "--pix-drop": "3px" } as React.CSSProperties}
    >
      {t("Illustrative homes, not Gamuda's plan")}
    </div>
  );
}

export const siteLabels = siteLayout.labels;
