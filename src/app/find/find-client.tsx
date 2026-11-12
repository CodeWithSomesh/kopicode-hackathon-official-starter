"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { township } from "@/lib/first-key/township";
import { groupById, groupOfHouse } from "@/lib/first-key/landed";
import type { Unit } from "@/lib/first-key/types";
import { usePrefersReducedMotion } from "@/components/first-key/use-reduced-motion";
import { anchorOptions } from "@/lib/homelander/data";
import { useHomeLander } from "@/lib/homelander/store";
import { useT } from "@/lib/homelander/i18n/client";
import { townInfoById } from "@/app/(homelander)/_landing/map-data";
import { MapControls, type ControlMap } from "@/app/(homelander)/_landing/map-controls";
import { PitchCard } from "@/app/(homelander)/_landing/pitch-card";
import { TownPanel } from "@/app/(homelander)/_landing/town-panel";
import { TownshipList } from "@/app/(homelander)/_landing/township-list";
import { useMapView } from "@/components/first-key/burst/map-view";

// Both scenes need the browser's WebGL: never render them on the server.
// Mapbox (Standard style) when the public token is set; otherwise the MapLibre map, so a missing token never means a blank page.
const HAS_MAPBOX = !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const NeighbourhoodMap = dynamic(
  () => (HAS_MAPBOX ? import("@/components/first-key/map/mapbox-map") : import("@/components/first-key/map/neighbourhood-map")),
  { ssr: false },
);
const COVE_ID = "cove"; // the illustrative block sits inside this township (id in src/lib/homelander/data.ts)
// Older /find?dev= links used the First Key ids.
const DEV_ALIAS: Record<string, string> = {
  "gamuda-cove": "cove",
  "gamuda-gardens": "gardens",
  "kundang-estates": "kundang",
  "jade-hills": "jade",
  twentyfive7: "tf7",
};
const LandedBurst = dynamic(
  () => import("@/components/first-key/burst/landed-burst").then((m) => m.LandedBurst),
  { ssr: false },
);
const BuildingBurst = dynamic(
  () => import("@/components/first-key/burst/building-burst").then((m) => m.BuildingBurst),
  { ssr: false },
);

type Props = { initialBuilding?: string; initialUnit?: string; initialDev?: string };

export function FindClient(props: Props) {
  return <Find {...props} />;
}

function Find({ initialBuilding, initialUnit, initialDev }: Props) {
  // a building is a tower, or a landed enclave group (terrace row, pair, bungalow) whose house is the `unit`
  const valid = township.buildings.some((b) => b.id === initialBuilding) || !!(initialBuilding && groupById(initialBuilding));
  const [selectedId, setSelectedId] = useState<string | undefined>(valid ? initialBuilding : undefined);
  const [unitId, setUnitId] = useState<string | undefined>(valid ? initialUnit : undefined);
  // A building always belongs to Gamuda Cove; otherwise ?dev= picks the township.
  const wanted = initialDev && (DEV_ALIAS[initialDev] ?? initialDev);
  const [devId, setDevId] = useState<string | undefined>(valid ? COVE_ID : wanted && townInfoById[wanted] ? wanted : undefined);
  const [map, setMap] = useState<ControlMap | null>(null);
  const hl = useHomeLander();
  const t = useT();
  const workAnchor = anchorOptions.find((a) => a.id === hl.anchorId) ?? anchorOptions[0]!;
  const [burstOpen, setBurstOpen] = useState(false);
  const [burstMounted, setBurstMounted] = useState(false); // keep the 3D scene once built; it idles on demand
  const [leaving, setLeaving] = useState(false); // the 3D shot plays back out before the map returns
  const [view, captureView] = useMapView(map);
  const overlay = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const building = township.buildings.find((b) => b.id === selectedId);
  const group = selectedId ? groupById(selectedId) : undefined;

  // Keep the URL shareable: /?building=c&unit=12-03 or /?dev=cove
  useEffect(() => {
    const q = new URLSearchParams();
    if (selectedId) q.set("building", selectedId);
    else if (devId) q.set("dev", devId);
    if (selectedId && unitId) q.set("unit", unitId);
    window.history.replaceState(null, "", q.size ? `/?${q}` : "/");
  }, [selectedId, unitId, devId]);

  const info = devId ? townInfoById[devId] : undefined;

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

  // the 3D shot is back on the map's pose: crossfade out while the map is still paused, then let it fly out
  const onClosed = () =>
    gsap.to(overlay.current, {
      autoAlpha: 0,
      duration: reduced ? 0 : 0.35,
      onComplete: () => {
        setLeaving(false);
        setBurstOpen(false);
      },
    });

  const open = () => {
    captureView();
    setLeaving(false);
    setBurstMounted(true);
    setBurstOpen(true);
  };

  return (
    <main className="fixed inset-0 overflow-hidden bg-sky text-ink">
      <div inert={burstOpen} className="contents">
      <NeighbourhoodMap
        selectedId={selectedId}
        houseId={group ? unitId : undefined}
        onSelect={(id) => {
          const g = id ? groupOfHouse(id) : undefined; // a click on a landed house opens its group with that house picked
          setSelectedId(g ? g.id : id);
          setUnitId(g ? id : undefined);
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
      </div>

      <h1 className="sr-only lg:hidden">{t("Gamuda Land map")}</h1>

      {/* The tower view covers all of this: keep it out of the Tab order and the accessibility tree while it is open */}
      <div inert={burstOpen}>
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
        <MapControls map={map} panelOpen={!!info && !burstOpen} cycleLight={HAS_MAPBOX} />
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

        {!info && !burstOpen && <PitchCard />}
      </div>

      {/* Map credit: always visible (above the tab bar on phones) */}
      {!HAS_MAPBOX && (
      <p
        inert={burstOpen}
        className="absolute right-3 bottom-[104px] z-10 px-1.5 py-0.5 text-[10px] leading-tight text-ink lg:right-2 lg:bottom-2"
        style={{ background: "color-mix(in srgb, var(--j-surface, white) 90%, transparent)" }} // the theme's surface, so night is not a white box
      >
        {HAS_MAPBOX ? null : process.env.NEXT_PUBLIC_PMTILES_URL ? (
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
      )}

      <div
        ref={overlay}
        className="invisible absolute inset-0 z-10 opacity-0"
        aria-hidden={!burstOpen}
        inert={!burstOpen}
      >
        <div className="absolute inset-x-0 top-[76px] z-10 flex items-center justify-between border-b bg-card/90 px-4 py-2 text-card-foreground backdrop-blur">
          <h1 className="text-base font-semibold">
            {building
              ? t("Block {block}: {floors} floors, {n} units", { block: building.block, floors: building.floors, n: building.units.length })
              : group
                ? t(group.houses.length === 1 ? "{kind}: {n} landed home" : "{kind}: {n} landed homes", {
                    kind: group.houses.length === 1 ? t("Bungalow") : group.houses.length === 2 ? t("Semi-D pair") : t("Terrace row"),
                    n: group.houses.length,
                  })
                : t("Building")}
          </h1>
          <Button variant="ghost" size="icon" aria-label={t("Back to the map")} onClick={() => setLeaving(true)}>
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
              onClosed={onClosed}
            />
          )}
          {group && burstMounted && (
            <LandedBurst
              key={group.id}
              group={group}
              selectedHouseId={unitId}
              onSelectHouse={(h) => setUnitId(h.id)}
              active={burstOpen}
              open={burstOpen && !leaving}
              view={view}
              onClosed={onClosed}
            />
          )}
        </div>
      </div>
    </main>
  );
}
