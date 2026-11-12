"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { township } from "@/lib/first-key/township";
import type { Unit } from "@/lib/first-key/types";
import { usePrefersReducedMotion } from "@/components/first-key/use-reduced-motion";
import type { Map as MLMap } from "maplibre-gl";
import { anchorOptions } from "@/lib/homelander/data";
import { useHomeLander } from "@/lib/homelander/store";
import { townInfoById } from "@/app/(homelander)/_landing/map-data";
import { MapControls } from "@/app/(homelander)/_landing/map-controls";
import { TownPanel } from "@/app/(homelander)/_landing/town-panel";
import { TownshipList } from "@/app/(homelander)/_landing/township-list";

// Both scenes need the browser's WebGL: never render them on the server.
const NeighbourhoodMap = dynamic(() => import("@/components/first-key/map/neighbourhood-map"), { ssr: false });
const COVE_ID = "cove"; // the illustrative block sits inside this township (id in src/lib/homelander/data.ts)
// Older /find?dev= links used the First Key ids.
const DEV_ALIAS: Record<string, string> = {
  "gamuda-cove": "cove",
  "gamuda-gardens": "gardens",
  "kundang-estates": "kundang",
  "jade-hills": "jade",
  twentyfive7: "tf7",
};
const BuildingBurst = dynamic(
  () => import("@/components/first-key/burst/building-burst").then((m) => m.BuildingBurst),
  { ssr: false },
);

type Props = { initialBuilding?: string; initialUnit?: string; initialDev?: string };

export function FindClient({ initialBuilding, initialUnit, initialDev }: Props) {
  const valid = township.buildings.some((b) => b.id === initialBuilding);
  const [selectedId, setSelectedId] = useState<string | undefined>(valid ? initialBuilding : undefined);
  const [unitId, setUnitId] = useState<string | undefined>(valid ? initialUnit : undefined);
  // A building always belongs to Gamuda Cove; otherwise ?dev= picks the township.
  const wanted = initialDev && (DEV_ALIAS[initialDev] ?? initialDev);
  const [devId, setDevId] = useState<string | undefined>(valid ? COVE_ID : wanted && townInfoById[wanted] ? wanted : undefined);
  const [map, setMap] = useState<MLMap | null>(null);
  const hl = useHomeLander();
  const workAnchor = anchorOptions.find((a) => a.id === hl.anchorId) ?? anchorOptions[0]!;
  const [burstOpen, setBurstOpen] = useState(false);
  const [burstMounted, setBurstMounted] = useState(false); // keep the 3D scene once built; it idles on demand
  const overlay = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const building = township.buildings.find((b) => b.id === selectedId);

  // Keep the URL shareable: /?building=c&unit=12-03 or /?dev=cove
  useEffect(() => {
    const q = new URLSearchParams();
    if (selectedId) q.set("building", selectedId);
    else if (devId) q.set("dev", devId);
    if (selectedId && unitId) q.set("unit", unitId);
    window.history.replaceState(null, "", q.size ? `/?${q}` : "/");
  }, [selectedId, unitId, devId]);

  const info = devId ? townInfoById[devId] : undefined;

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
    <main className="fixed inset-0 overflow-hidden bg-sky text-ink">
      <NeighbourhoodMap
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setUnitId(undefined);
          if (id) setDevId(COVE_ID);
        }}
        devId={devId}
        onMapReady={setMap}
        onSelectDev={(id) => {
          setSelectedId(undefined);
          setUnitId(undefined);
          setDevId(id);
        }}
        paused={burstOpen}
        onArrived={open}
        startAtSelected={valid}
      />

      <h1 className="sr-only lg:hidden">Gamuda Land map</h1>

      <TownshipList
        selected={devId}
        anchorName={workAnchor.name}
        onPick={(id) => {
          setSelectedId(undefined);
          setUnitId(undefined);
          setDevId(id);
        }}
        onShowAll={() => {
          setSelectedId(undefined);
          setUnitId(undefined);
          setDevId(undefined);
        }}
      />
      <MapControls map={map} panelOpen={!!info && !burstOpen} />
      {info && !burstOpen && (
        <TownPanel
          key={info.t.id}
          info={info}
          anchor={workAnchor}
          illustrative={info.t.id === COVE_ID}
          onClose={() => {
            setSelectedId(undefined);
            setUnitId(undefined);
            setDevId(undefined);
          }}
        />
      )}

      {/* Map credit: always visible (above the tab bar on phones) */}
      <p className="absolute right-3 bottom-[104px] z-10 bg-white/90 px-1.5 py-0.5 text-[10px] leading-tight text-ink lg:right-2 lg:bottom-2">
        {process.env.NEXT_PUBLIC_PMTILES_URL ? (
          <>
            <a href="https://protomaps.com" target="_blank" rel="noreferrer" className="underline">Protomaps</a> ©{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>
          </>
        ) : (
          <>
            <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="underline">OpenFreeMap</a>{" "}
            <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer" className="underline">© OpenMapTiles</a> Data from{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap</a>
          </>
        )}
      </p>

      <div
        ref={overlay}
        className="invisible absolute inset-0 z-10 flex flex-col bg-background pt-[76px] pb-[104px] opacity-0 lg:pb-0"
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
