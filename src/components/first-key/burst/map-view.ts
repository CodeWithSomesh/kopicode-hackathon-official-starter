import { useState } from "react";
import { useMap } from "react-map-gl/maplibre";
import type { LngLat } from "@/lib/first-key/types";

export { MapProvider } from "react-map-gl/maplibre";

/** The map's camera when the 3D view takes over, so the first 3D frame matches it. */
export type MapView = { bearing: number; pitch: number; fov: number; distanceM: number; center: LngLat };

// Structural type: keeps maplibre-gl out of the page's main chunk.
type MapLike = {
  getBearing(): number;
  getPitch(): number;
  getZoom(): number;
  getVerticalFieldOfView(): number;
  getCenter(): { lng: number; lat: number };
  getContainer(): HTMLElement;
};

/** Camera-to-centre distance in metres: MapLibre puts the camera 0.5 * height / tan(fov / 2) pixels from the centre. */
export function mapViewOf(map: MapLike): MapView {
  const { lng, lat } = map.getCenter();
  const fov = map.getVerticalFieldOfView();
  const mPerPx = (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
  const px = (0.5 * map.getContainer().clientHeight) / Math.tan((fov * Math.PI) / 360);
  return { bearing: map.getBearing(), pitch: map.getPitch(), fov, distanceM: px * mPerPx, center: [lng, lat] };
}

/**
 * The page's side of the hand-over: call capture() when the map arrives at a building, pass view to BuildingBurst.
 * Needs a MapProvider above the page (the map registers itself as "default").
 */
export function useMapView() {
  const maps = useMap();
  const [view, setView] = useState<MapView>();
  const capture = () => {
    const map = maps.default?.getMap();
    if (map) setView(mapViewOf(map));
  };
  return [view, capture] as const;
}
