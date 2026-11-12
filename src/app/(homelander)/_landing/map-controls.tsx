"use client";

import type { Map as MLMap } from "maplibre-gl";
import { useEffect, useState } from "react";
import { PixButton } from "@/components/homelander/pixel";
import { Sprite } from "@/components/homelander/sprite";
import { cn } from "@/lib/utils";
import { mapSprites } from "./map-data";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Zoom, compass and 2D/3D buttons. They drive the MapLibre map handed up by the map component. */
export function MapControls({ map, panelOpen }: { map: MLMap | null; panelOpen: boolean }) {
  const [bearing, setBearing] = useState(0);
  const [is3D, setIs3D] = useState(true);
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
  return (
    <div className={cn("absolute top-[136px] right-4 z-10 grid gap-3", "lg:top-[92px]", panelOpen ? "lg:right-[436px]" : "lg:right-6")}>
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
    </div>
  );
}
