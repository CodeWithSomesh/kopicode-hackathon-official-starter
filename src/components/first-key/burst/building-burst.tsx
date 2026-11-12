"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useSpring, type SpringValue } from "@react-spring/three";
import type { Building, Unit } from "@/lib/first-key/types";
import { useThemeColors, type ThemeColors } from "../use-theme-colors";
import { usePrefersReducedMotion } from "../use-reduced-motion";
import { BANDS, bandOf } from "./price-band";

// Scene units are "dollhouse metres", not true plan size.
const UNIT_W = 3.6;
const UNIT_D = 5;
const FLOOR_H = 3.1;
const GAP_MAX = 2.6; // extra space between floors when fully open
const DEPTH = UNIT_D * 2 + 0.6;

const layout = (b: Building) => ({ cols: Math.ceil(b.units.filter((u) => u.floor === 1).length / 2) });

type Props = {
  building: Building;
  selectedUnitId?: string;
  onSelectUnit: (unit: Unit) => void;
  /** false = the map is showing; the 3D scene stops rendering (frameloop demand). */
  active: boolean;
};

export function BuildingBurst({ building, selectedUnitId, onSelectUnit, active }: Props) {
  const reduced = usePrefersReducedMotion();
  const colors = useThemeColors();
  // One number 0..1 drives floors and cut plane. Reduced motion: half open, slider still works.
  const [progress, setProgress] = useState(reduced ? 0.5 : 0);
  const drag = useRef<{ y: number; p: number } | null>(null);

  const selected = building.units.find((u) => u.unit === selectedUnitId);

  return (
    <div className="flex h-full w-full flex-col">
      <div
        className="relative min-h-0 flex-1 touch-none select-none"
        onPointerDown={(e) => {
          drag.current = { y: e.clientY, p: progress };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          // dragging up opens the building, down closes it
          setProgress(Math.min(1, Math.max(0, drag.current.p + (drag.current.y - e.clientY) / 320)));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <Canvas
          orthographic
          dpr={[1, 2]}
          frameloop={active ? "always" : "demand"}
          camera={{ position: [40, 34, 40], near: -500, far: 500 }}
          gl={{ localClippingEnabled: true, antialias: true }}
          aria-label="3D view of the building"
        >
          <Scene
            building={building}
            colors={colors}
            progress={progress}
            reduced={reduced}
            selectedUnitId={selectedUnitId}
            onSelectUnit={onSelectUnit}
          />
        </Canvas>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t bg-card px-4 py-3 text-card-foreground">
        <label className="flex min-w-48 flex-1 items-center gap-3 text-sm">
          <span className="shrink-0 font-medium">Open it up</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </label>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Price colours">
          {BANDS.map((b) => (
            <li key={b.label} className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ background: `var(--${b.token})` }} />
              {b.label}
            </li>
          ))}
        </ul>
        <p className="w-full text-sm" aria-live="polite">
          {selected ? (
            <>
              <strong>Unit {selected.unit}</strong>: {selected.type}, {selected.sizeSqft} sqft, RM
              {selected.price.toLocaleString()} (about RM{selected.monthly.toLocaleString()} a month),
              facing {selected.facing}
            </>
          ) : (
            <span className="text-muted-foreground">Tap a unit. Drag up or down, or use the slider, to open the building.</span>
          )}
        </p>
      </div>
    </div>
  );
}

function Scene({
  building,
  colors,
  progress,
  reduced,
  selectedUnitId,
  onSelectUnit,
}: {
  building: Building;
  colors: ThemeColors;
  progress: number;
  reduced: boolean;
  selectedUnitId?: string;
  onSelectUnit: (unit: Unit) => void;
}) {
  const { invalidate, camera, size } = useThree();
  const { cols } = layout(building);
  const width = cols * UNIT_W + 0.6;

  // Springs smooth the single progress value; reduced motion jumps straight to it.
  const [spring] = useSpring(
    () => ({ p: progress, immediate: reduced, config: { tension: 120, friction: 22 }, onChange: () => invalidate() }),
    [progress, reduced],
  );

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 0), []);
  const mats = useMemo(() => {
    const make = (c: string, extra?: THREE.MeshStandardMaterialParameters) =>
      new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, clippingPlanes: [plane], roughness: 0.7, ...extra });
    return {
      bands: BANDS.map((b) => make(colors[b.token])),
      slab: make(colors["muted-foreground"]),
      selected: new THREE.MeshStandardMaterial({
        color: colors.foreground, // not primary: price band 4 already uses the primary hue
        emissive: colors.foreground,
        emissiveIntensity: 0.4,
        roughness: 0.5,
      }),
    };
  }, [colors, plane]);

  useEffect(() => invalidate(), [colors, selectedUnitId, invalidate]);

  useFrame(() => stepFrame(spring.p.get(), plane, camera as THREE.OrthographicCamera, size, building.floors, width));

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[30, 60, 20]} intensity={2.2} />
      {Array.from({ length: building.floors }, (_, i) => i + 1).map((f) => (
        <Floor
          key={f}
          floor={f}
          spring={spring.p}
          units={building.units.filter((u) => u.floor === f)}
          width={width}
          mats={mats}
          plane={plane}
          selectedUnitId={selectedUnitId}
          onSelectUnit={onSelectUnit}
        />
      ))}
    </>
  );
}

// Per-frame scene update, outside the component because three.js objects are mutated in place.
function stepFrame(
  p: number,
  plane: THREE.Plane,
  camera: THREE.OrthographicCamera,
  size: { width: number; height: number },
  floors: number,
  width: number,
) {
  plane.constant = (DEPTH / 2 + 0.2) * (1 - p); // keep z <= constant: slides the front row away
  const extent = floors * FLOOR_H + p * (floors - 1) * GAP_MAX;
  const cy = extent / 2;
  camera.position.set(40, cy + 34, 40);
  camera.lookAt(0, cy, 0);
  camera.zoom = Math.min((size.height * 0.85) / (extent * 0.82 + 16), (size.width * 0.9) / ((width + DEPTH) * 0.71));
  camera.updateProjectionMatrix();
}

function Floor({
  floor,
  spring,
  units,
  width,
  mats,
  plane,
  selectedUnitId,
  onSelectUnit,
}: {
  floor: number;
  spring: SpringValue<number>;
  units: Unit[];
  width: number;
  mats: { bands: THREE.Material[]; slab: THREE.Material; selected: THREE.Material };
  plane: THREE.Plane;
  selectedUnitId?: string;
  onSelectUnit: (unit: Unit) => void;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (group.current) group.current.position.y = (floor - 1) * (FLOOR_H + spring.get() * GAP_MAX);
  });
  return (
    <group ref={group}>
      <mesh position={[0, -0.15, 0]} material={mats.slab}>
        <boxGeometry args={[width, 0.3, DEPTH]} />
      </mesh>
      {units.map((u, i) => {
        const col = Math.floor(i / 2);
        const front = i % 2 === 0;
        const isSelected = u.unit === selectedUnitId;
        return (
          <mesh
            key={u.unit}
            position={[(col - ((width - 0.6) / UNIT_W - 1) / 2) * UNIT_W, FLOOR_H * 0.4, (front ? 1 : -1) * (UNIT_D / 2 + 0.1)]}
            scale={isSelected ? 1.12 : 1}
            material={isSelected ? mats.selected : mats.bands[bandOf(u.price)]}
            onClick={(e) => {
              if (e.delta > 4) return; // it was a drag, not a tap
              if (!isSelected && e.point.z > plane.constant) return; // that part is cut away
              e.stopPropagation();
              onSelectUnit(u);
            }}
          >
            <boxGeometry args={[UNIT_W - 0.2, FLOOR_H * 0.8, UNIT_D - 0.2]} />
          </mesh>
        );
      })}
    </group>
  );
}
