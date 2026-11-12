"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { township } from "@/lib/first-key/township";
import { developments, onMap } from "@/lib/first-key/developments";
import type { Unit } from "@/lib/first-key/types";
import { usePrefersReducedMotion } from "@/components/first-key/use-reduced-motion";
import { DevelopmentCard } from "./development-card";

// Both scenes need the browser's WebGL: never render them on the server.
const NeighbourhoodMap = dynamic(() => import("@/components/first-key/map/neighbourhood-map"), { ssr: false });
const COVE_ID = "gamuda-cove"; // the illustrative block sits inside this development (same id as in the map)
const BuildingBurst = dynamic(
  () => import("@/components/first-key/burst/building-burst").then((m) => m.BuildingBurst),
  { ssr: false },
);

type Props = { initialBuilding?: string; initialUnit?: string; initialDev?: string };

export function FindClient({ initialBuilding, initialUnit, initialDev }: Props) {
  const valid = township.buildings.some((b) => b.id === initialBuilding);
  const [selectedId, setSelectedId] = useState<string | undefined>(valid ? initialBuilding : undefined);
  const [unitId, setUnitId] = useState<string | undefined>(valid ? initialUnit : undefined);
  // A building always belongs to Gamuda Cove; otherwise ?dev= picks the development (only ones drawn on the map).
  const devValid = developments.some((d) => d.id === initialDev && onMap(d));
  const [devId, setDevId] = useState<string | undefined>(valid ? COVE_ID : devValid ? initialDev : undefined);
  const [burstOpen, setBurstOpen] = useState(false);
  const [burstMounted, setBurstMounted] = useState(false); // keep the 3D scene once built; it idles on demand
  const overlay = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const building = township.buildings.find((b) => b.id === selectedId);

  // Keep the URL shareable: /find?building=c&unit=12-03 or /find?dev=gamuda-cove
  useEffect(() => {
    const q = new URLSearchParams();
    if (selectedId) q.set("building", selectedId);
    else if (devId) q.set("dev", devId);
    if (selectedId && unitId) q.set("unit", unitId);
    window.history.replaceState(null, "", q.size ? `/find?${q}` : "/find");
  }, [selectedId, unitId, devId]);

  const dev = developments.find((d) => d.id === devId);

  // Hand-over: the 3D view fades and settles in over the map; the map has stopped moving underneath.
  useEffect(() => {
    const el = overlay.current;
    if (!el || !burstMounted) return;
    if (reduced) {
      gsap.set(el, { autoAlpha: burstOpen ? 1 : 0, scale: 1 });
      return;
    }
    const tween = gsap.to(el, {
      autoAlpha: burstOpen ? 1 : 0,
      scale: burstOpen ? 1 : 0.97,
      duration: burstOpen ? 0.6 : 0.35,
      ease: "power2.inOut",
    });
    return () => void tween.kill();
  }, [burstOpen, burstMounted, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBurstOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = () => {
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
          if (id) setDevId(COVE_ID);
        }}
        devId={devId}
        onSelectDev={(id) => {
          setSelectedId(undefined);
          setUnitId(undefined);
          setDevId(id);
        }}
        paused={burstOpen}
        onArrived={open}
        startAtSelected={valid}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 p-4">
        <p className="inline-block rounded-md border bg-card/90 px-3 py-1.5 text-sm text-card-foreground shadow-sm backdrop-blur">
          <strong>Gamuda Land developments</strong>{" "}
          <span className="text-muted-foreground">· Klang Valley · unit numbers are made up</span>
        </p>
      </header>

      {dev && !burstOpen && (
        <DevelopmentCard
          dev={dev}
          isCove={dev.id === COVE_ID}
          onBack={() => {
            setSelectedId(undefined);
            setUnitId(undefined);
            setDevId(undefined);
          }}
        />
      )}

      <div
        ref={overlay}
        className="invisible absolute inset-0 z-10 flex flex-col bg-background opacity-0"
        aria-hidden={!burstOpen}
        inert={!burstOpen}
      >
        <div className="flex items-center justify-between border-b bg-card px-4 py-2 text-card-foreground">
          <h1 className="text-base font-semibold">
            {building ? `Block ${building.block}: ${building.floors} floors, ${building.units.length} units` : "Building"}
          </h1>
          <Button variant="ghost" size="icon" aria-label="Back to the map" onClick={() => setBurstOpen(false)}>
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          {building && burstMounted && (
            <BuildingBurst
              key={building.id}
              building={building}
              selectedUnitId={unitId}
              onSelectUnit={(u: Unit) => setUnitId(u.unit)}
              active={burstOpen}
            />
          )}
        </div>
      </div>
    </main>
  );
}
