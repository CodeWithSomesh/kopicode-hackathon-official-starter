import { useState } from "react";
import type { LngLat } from "@/lib/first-key/types";

/** The map's camera when the 3D view takes over, so the first 3D frame matches it. */
export type MapView = { bearing: number; pitch: number; fov: number; distanceM: number; center: LngLat };

// Structural type: keeps maplibre-gl / mapbox-gl out of the page's main chunk. Both maps satisfy it
// (Mapbox has no getVerticalFieldOfView: its Transform.fov is read instead, 36.87 deg by default, same as MapLibre).
export type MapLike = {
  getBearing(): number;
  getPitch(): number;
  getZoom(): number;
  getVerticalFieldOfView?(): number;
  transform?: { fov: number };
  getCenter(): { lng: number; lat: number };
  getContainer(): HTMLElement;
};

/** Camera-to-centre distance in metres: MapLibre puts the camera 0.5 * height / tan(fov / 2) pixels from the centre. */
export function mapViewOf(map: MapLike): MapView {
  const { lng, lat } = map.getCenter();
  const raw = map.getVerticalFieldOfView?.() ?? map.transform?.fov ?? 36.87;
  const fov = raw < 3 ? (raw * 180) / Math.PI : raw; // degrees; guard against a radians getter
  const mPerPx = (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
  const px = (0.5 * map.getContainer().clientHeight) / Math.tan((fov * Math.PI) / 360);
  return { bearing: map.getBearing(), pitch: map.getPitch(), fov, distanceM: px * mPerPx, center: [lng, lat] };
}

/**
 * The page's side of the hand-over: call capture() when the map arrives at a building, pass view to BuildingBurst.
 * Pass the map instance the map component handed up through onMapReady.
 */
export function useMapView(map: MapLike | null) {
  const [view, setView] = useState<MapView>();
  const capture = () => {
    if (map) setView(mapViewOf(map));
  };
  return [view, capture] as const;
}
