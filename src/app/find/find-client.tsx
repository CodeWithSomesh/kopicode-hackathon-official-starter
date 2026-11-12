"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { township } from "@/lib/first-key/township";
import type { Unit } from "@/lib/first-key/types";
import { usePrefersReducedMotion } from "@/components/first-key/use-reduced-motion";
import { MapProvider, useMapView } from "@/components/first-key/burst/map-view";

// Both scenes need the browser's WebGL: never render them on the server.
const NeighbourhoodMap = dynamic(() => import("@/components/first-key/map/neighbourhood-map"), { ssr: false });
const BuildingBurst = dynamic(
  () => import("@/components/first-key/burst/building-burst").then((m) => m.BuildingBurst),
  { ssr: false },
);

type Props = { initialBuilding?: string; initialUnit?: string };

// MapProvider lets the page read the map's camera at hand-over, so the 3D view starts on the same frame.
export function FindClient(props: Props) {
  return (
    <MapProvider>
      <Find {...props} />
    </MapProvider>
  );
}

function Find({ initialBuilding, initialUnit }: Props) {
  const valid = township.buildings.some((b) => b.id === initialBuilding);
  const [selectedId, setSelectedId] = useState<string | undefined>(valid ? initialBuilding : undefined);
  const [unitId, setUnitId] = useState<string | undefined>(valid ? initialUnit : undefined);
  const [burstOpen, setBurstOpen] = useState(false);
  const [burstMounted, setBurstMounted] = useState(false); // keep the 3D scene once built; it idles on demand
  const [leaving, setLeaving] = useState(false); // the 3D shot plays back out before the map returns
  const [view, captureView] = useMapView();
  const overlay = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const building = township.buildings.find((b) => b.id === selectedId);

  // Keep the URL shareable: /find?building=c&unit=12-03
  useEffect(() => {
    const q = new URLSearchParams();
    if (selectedId) q.set("building", selectedId);
    if (selectedId && unitId) q.set("unit", unitId);
    window.history.replaceState(null, "", q.size ? `/find?${q}` : "/find");
  }, [selectedId, unitId]);

  // Hand-over: a crossfade on the matched camera pose; the 3D shot then moves on its own.
  useEffect(() => {
    const el = overlay.current;
    if (!el || !burstMounted) return;
    if (reduced) {
      gsap.set(el, { autoAlpha: burstOpen ? 1 : 0 });
      return;
    }
    const tween = gsap.to(el, { autoAlpha: burstOpen ? 1 : 0, duration: 0.4, ease: "power1.inOut" });
    return () => void tween.kill();
  }, [burstOpen, burstMounted, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLeaving(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = () => {
    captureView();
    setLeaving(false);
    setBurstMounted(true);
    setBurstOpen(true);
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <NeighbourhoodMap
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setUnitId(undefined);
        }}
        paused={burstOpen}
        onArrived={open}
        startAtSelected={valid}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 p-4">
        <p className="inline-block rounded-md border bg-card/90 px-3 py-1.5 text-sm text-card-foreground shadow-sm backdrop-blur">
          <strong>{township.name}</strong> <span className="text-muted-foreground">· made-up township, illustrative numbers</span>
        </p>
      </header>

      <div
        ref={overlay}
        className="invisible absolute inset-0 z-10 opacity-0"
        aria-hidden={!burstOpen}
        inert={!burstOpen}
      >
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b bg-card/90 px-4 py-2 text-card-foreground backdrop-blur">
          <h1 className="text-base font-semibold">
            {building ? `Block ${building.block}: ${building.floors} floors, ${building.units.length} units` : "Building"}
          </h1>
          <Button variant="ghost" size="icon" aria-label="Back to the map" onClick={() => setLeaving(true)}>
            <X />
          </Button>
        </div>
        <div className="absolute inset-0">
          {building && burstMounted && (
            <BuildingBurst
              key={building.id}
              building={building}
              selectedUnitId={unitId}
              onSelectUnit={(u: Unit) => setUnitId(u.unit)}
              active={burstOpen}
              open={burstOpen && !leaving}
              view={view}
              onClosed={() =>
                // the 3D shot is back on the map's pose: crossfade out while the map is still paused, then let it fly out
                gsap.to(overlay.current, {
                  autoAlpha: 0,
                  duration: reduced ? 0 : 0.35,
                  onComplete: () => {
                    setLeaving(false);
                    setBurstOpen(false);
                  },
                })
              }
            />
          )}
        </div>
      </div>
    </main>
  );
}
