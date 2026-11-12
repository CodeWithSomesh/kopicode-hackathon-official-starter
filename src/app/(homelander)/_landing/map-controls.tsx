"use client";

import type { MapLike } from "@/components/first-key/burst/map-view";
import { useEffect, useState } from "react";
import { PixButton } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { cn } from "@/lib/utils";
import { setMapDusk, setMapNight, useMapDusk, useMapNight } from "@/components/first-key/use-map-colors";
import { mapSprites } from "./map-data";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** What the buttons need from a map: MapLibre and Mapbox maps both fit. */
export type ControlMap = MapLike & {
  on(type: string, fn: () => void): unknown;
  off(type: string, fn: () => void): unknown;
  zoomIn(o: { animate: boolean }): unknown;
  zoomOut(o: { animate: boolean }): unknown;
  resetNorth(o: { animate: boolean }): unknown;
  easeTo(o: { pitch: number; duration: number }): unknown;
};

/** Zoom, compass and 2D/3D buttons. They drive the MapLibre map handed up by the map component. */
export function MapControls({ map, panelOpen, cycleLight }: { map: ControlMap | null; panelOpen: boolean; cycleLight?: boolean }) {
  const [bearing, setBearing] = useState(0);
  const [is3D, setIs3D] = useState(true);
  const night = useMapNight();
  const dusk = useMapDusk() && !night;
  // Mapbox: Day -> Dusk -> Night -> Day. MapLibre has only day and night.
  const light = night ? "Night" : dusk ? "Dusk" : "Day";
  const nextLight = () => {
    if (!cycleLight) return setMapNight(!night);
    if (night) setMapNight(false);
    else if (dusk) {
      setMapDusk(false);
      setMapNight(true);
    } else setMapDusk(true);
  };
  useEffect(() => {
    if (!map) return;
    const onRotate = () => setBearing(map.getBearing());
    const onPitch = () => setIs3D(map.getPitch() > 10);
    onRotate();
    onPitch();
    map.on("rotate", onRotate);
    map.on("pitchend", onPitch);
    return () => {
      map.off("rotate", onRotate);
      map.off("pitchend", onPitch);
    };
  }, [map]);
  if (!map) return null;
  const animate = !reduced();
  // phones: two columns, so the stack ends above the township sheet (which starts ~280 px down) and Night / 2D stay tappable
  return (
    <div data-obstacle className={cn("absolute top-[120px] right-4 z-10 grid grid-cols-2 gap-2 lg:top-[92px] lg:grid-cols-1 lg:gap-3", panelOpen ? "lg:right-[436px]" : "lg:right-6")}>
      <PixButton size="sm" className="size-10 px-0" onClick={() => map.zoomIn({ animate })} aria-label="Zoom in">
        <Sprite art={mapSprites.plus} scale={3} />
      </PixButton>
      <PixButton size="sm" className="size-10 px-0" onClick={() => map.zoomOut({ animate })} aria-label="Zoom out">
        <Sprite art={mapSprites.minus} scale={3} />
      </PixButton>
      <PixButton size="sm" className="size-10 px-0" onClick={() => map.resetNorth({ animate })} aria-label="Point the map north">
        <Sprite art={mapSprites.needle} scale={2} style={{ transform: `rotate(${-bearing}deg)` }} />
      </PixButton>
      <PixButton
        size="sm"
        className="size-10 px-0 text-sm"
        onClick={() => map.easeTo({ pitch: is3D ? 0 : 52, duration: animate ? 600 : 0 })}
        aria-label={is3D ? "Switch to flat 2D view" : "Switch to tilted 3D view"}
      >
        {is3D ? "2D" : "3D"}
      </PixButton>
      <PixButton
        size="sm"
        tone={night || dusk ? "kaya" : "white"}
        className="size-10 px-0 font-pixel-label text-[11px] uppercase"
        onClick={nextLight}
        {...(cycleLight
          ? { "aria-label": `Time of day: ${light.toLowerCase()}. Switch to ${(night ? "day" : dusk ? "night" : "dusk")}` }
          : { "aria-pressed": night, "aria-label": "Night view of the map and the building" })}
      >
        {cycleLight ? light : "Night"}
      </PixButton>
    </div>
  );
}
