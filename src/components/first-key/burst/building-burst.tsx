"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import type { Building, Unit } from "@/lib/first-key/types";
import { centroid } from "@/lib/first-key/geo";
import { useThemeColors, type ThemeColors } from "../use-theme-colors";
import { usePrefersReducedMotion } from "../use-reduced-motion";
import { BANDS, bandOf } from "./price-band";
import { FLOOR_H, LOW_H, planFloor, unitsOnFloor } from "./layout";
import { glassMaterials, InteriorMeshes, RoofTop, ShellBox, Balconies, outlineGeom, slabGeom } from "./dollhouse";
import type { MapView } from "./map-view";

const END_PITCH = 50; // the three-quarter view, degrees from straight down
const SHOT_S = 3;
const HOLD_S = 0.35; // the map crossfades into the 3D view on the matched first frame before the camera moves
const D2R = Math.PI / 180;

type Props = {
  building: Building;
  selectedUnitId?: string;
  onSelectUnit: (unit: Unit) => void;
  /** false = the map is showing; the 3D scene stops rendering (frameloop demand). */
  active: boolean;
  /** true plays the shot in; going false plays it back out to the map's pose, then calls onClosed. */
  open: boolean;
  /** The map's camera at hand-over; the first 3D frame matches it. */
  view?: MapView;
  onClosed?: () => void;
};

/** Camera and reveal state, tweened by GSAP and applied every frame. */
type Rig = { bearing: number; pitch: number; dist: number; tx: number; ty: number; tz: number; off: number; bg: number; lift: number };

const camOf = (r: Rig) => ({ bearing: r.bearing, pitch: r.pitch, dist: r.dist, tx: r.tx, ty: r.ty, tz: r.tz, off: r.off });

const footprintOf = (b: Building) => {
  const c = centroid(b.footprint);
  const kx = 111_320 * Math.cos(c[1] * D2R);
  const kz = 110_574;
  const xs = b.footprint.map((p) => (p[0] - c[0]) * kx);
  const zs = b.footprint.map((p) => (p[1] - c[1]) * kz);
  // The map's (chamfered) footprint in metres, x east and z south, so the 3D shell has the same corners.
  const outline = b.footprint.slice(0, -1).map((_, i) => [xs[i], -zs[i]] as [number, number]);
  // Straight run of the north facade (the chamfered corners cut it short): balconies stop there.
  const zTop = Math.max(...zs);
  const top = xs.filter((_, i) => Math.abs(zs[i] - zTop) < 0.05);
  const straight = Math.max(...top) - Math.min(...top);
  return { c, kx, kz, straight, w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs), outline };
};

const isDark = (rgb: string) => (rgb.match(/\d+/g) ?? ["255"]).slice(0, 3).reduce((t, v) => t + Number(v), 0) / 3 < 128;
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function BuildingBurst({ building, selectedUnitId, onSelectUnit, active, open, view, onClosed }: Props) {
  const reduced = usePrefersReducedMotion();
  const colors = useThemeColors();
  const selected = building.units.find((u) => u.unit === selectedUnitId);
  // The floor the cut shows: the picked unit's floor, else the top floor (the roof comes off first).
  const [floor, setFloor] = useState(selected?.floor ?? building.floors);
  const bg = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-full w-full select-none">
      {/* Fades in as the camera leaves the map's pose, so the map's ground does not slide under the moving 3D camera. */}
      <div ref={bg} className="absolute inset-0 bg-background opacity-0" />
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        shadows="percentage"
        dpr={[1, 1.5]}
        frameloop={active ? "always" : "demand"}
        camera={{ fov: view?.fov ?? 36.87, near: 1, far: 5000, position: [0, 300, 300] }}
        // NeutralToneMapping keeps theme colours true (R3F's default is ACES, which greys and shifts them).
        // NeutralToneMapping keeps theme colours true (R3F's default is ACES, which greys and shifts them).
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}
        aria-label={`3D view of block ${building.block}, floor ${floor}`}
      >
        <Scene
          building={building}
          colors={colors}
          floor={floor}
          reduced={reduced}
          open={open}
          view={view}
          onClosed={onClosed}
          bg={bg}
          selected={selected}
          onSelectUnit={onSelectUnit}
        />
      </Canvas>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-6 gap-y-2 border-t bg-card/90 px-4 py-3 text-card-foreground backdrop-blur max-lg:pb-[112px]">
        {building.floors > 1 && (
          <label className="flex min-w-48 flex-1 items-center gap-3 text-sm">
            <span className="shrink-0 font-medium tabular-nums">
              Floor {floor} <span className="text-muted-foreground">of {building.floors}</span>
            </span>
            <input
              type="range"
              min={1}
              max={building.floors}
              step={1}
              value={floor}
              onChange={(e) => setFloor(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
              aria-label="Floor to open"
            />
          </label>
        )}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Price colours">
          {BANDS.map((b) => (
            <li key={b.label} className="flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ background: `var(--${b.token})` }} />
              {b.label}
            </li>
          ))}
        </ul>
        <p className="w-full text-sm" aria-live="polite">
          {selected ? (
            <>
              <strong>Unit {selected.unit}</strong>: {selected.type}, {selected.sizeSqft} sqft, RM
              {selected.price.toLocaleString()} (about RM{selected.monthly.toLocaleString()} a month), facing {selected.facing}
            </>
          ) : (
            <span className="text-muted-foreground">Tap a home to see it. Move the floor slider to lift the floors above away.</span>
          )}
        </p>
      </div>
    </div>
  );
}

function Scene({
  building,
  colors,
  floor,
  reduced,
  open,
  view,
  onClosed,
  bg,
  selected,
  onSelectUnit,
}: {
  building: Building;
  colors: ThemeColors;
  floor: number;
  reduced: boolean;
  open: boolean;
  view?: MapView;
  onClosed?: () => void;
  bg: React.RefObject<HTMLDivElement | null>;
  selected?: Unit;
  onSelectUnit: (unit: Unit) => void;
}) {
  const { camera, size } = useThree();
  const fp = useMemo(() => footprintOf(building), [building]);
  const plan = useMemo(() => planFloor(unitsOnFloor(building, 1), fp.w / fp.d), [building, fp]);
  const floorUnits = useMemo(() => unitsOnFloor(building, floor), [building, floor]);
  const dark = isDark(colors.background);
  const floorY = (floor - 1) * FLOOR_H;

  // End bearing: the diagonal nearest the map's, so the swing is at most 45 degrees.
  const b0 = view?.bearing ?? -20;
  const b1 = Math.round((b0 - 45) / 90) * 90 + 45;
  // Horizontal direction from the building to the camera at the end pose; walls facing it are cut down.
  const toCam = useMemo<[number, number]>(() => [-Math.sin(b1 * D2R), Math.cos(b1 * D2R)], [b1]);
  const sx = fp.w / plan.w;
  const sz = fp.d / plan.d;

  // A built-in studio (no HDR download) for the glass and clearcoat to reflect.
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    Object.assign(scene, { environment: env, environmentIntensity: 0.6 });
    pmrem.dispose();
    return () => {
      Object.assign(scene, { environment: null });
      env.dispose();
    };
  }, [gl, scene]);
  const mats = useMemo(() => glassMaterials(colors, dark), [colors, dark]);
  // The map draws the picked block flat in the primary colour: the 3D block starts in that colour too and clears to glass.
  const tint = useMemo(
    () => new THREE.MeshLambertMaterial({ color: colors.primary, transparent: true, opacity: 0, depthWrite: false }),
    [colors.primary],
  );
  const tintGeom = useMemo(() => outlineGeom(fp.outline, 0.05, building.heightM + 0.15, 0.01, 0.05), [fp, building.heightM]);
  const plateGeom = useMemo(() => slabGeom(fp.w + 0.5, 0.3, fp.d + 0.5, 0.15), [fp]); // 15 cm fillet on the floor slab
  const ground = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colors.muted, transparent: true, opacity: 0, roughness: 1 }),
    [colors.muted],
  );

  const endPose = () => {
    // Fit the floor plate between the top bar and the bottom panel.
    const r = 0.5 * Math.hypot(fp.w, fp.d) * 0.92;
    const t = Math.tan(((view?.fov ?? 36.87) * D2R) / 2);
    // Phones: the shell's tab bar (~100 px, z-30) covers the panel's lower part, so reserve it too.
    const usable = Math.max(0.4, (size.height - 190 - (size.width < 1024 ? 100 : 0)) / size.height);
    const dist = r / Math.min(t * usable, t * (size.width / size.height) * 0.9);
    return { bearing: b1, pitch: END_PITCH, dist, tx: 0, ty: floorY + 0.9, tz: 0, off: 40, bg: 1, lift: 1 };
  };
  const startPose = (): Rig =>
    view
      ? {
          bearing: view.bearing,
          pitch: view.pitch,
          dist: view.distanceM,
          tx: (view.center[0] - fp.c[0]) * fp.kx,
          ty: 0,
          tz: -(view.center[1] - fp.c[1]) * fp.kz,
          off: 0,
          bg: 0,
          lift: 0,
        }
      : { ...endPose(), bearing: b1 - 35, pitch: 60, dist: endPose().dist * 3, ty: building.heightM * 0.5, lift: 0, off: 0 };

  const rig = useRef<Rig>({ bearing: 0, pitch: 60, dist: 300, tx: 0, ty: 0, tz: 0, off: 0, bg: 0, lift: 0 });
  const played = useRef(false);
  const [labels, setLabels] = useState(false);
  // drei's Html mounts its own React root; mounting it in the scene's first commit trips StrictMode's double mount
  // (a reduced-motion deep link did exactly that), so chips wait one tick after the scene mounts.
  const [labelReady, setLabelReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLabelReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  const showLabels = labelReady && open && (reduced || labels); // chips appear once the roof is off

  // The shot: one timeline in, a shorter one back out. Reduced motion jumps to the end pose.
  useEffect(() => {
    const r = rig.current;
    if (open) {
      played.current = true;
      if (reduced) {
        Object.assign(r, endPose());
        return;
      }
      Object.assign(r, startPose());
      const tl = gsap.timeline({ delay: HOLD_S, onStart: () => setLabels(false), onComplete: () => setLabels(true) });
      tl.to(r, { ...camOf(endPose()), duration: SHOT_S, ease: "power2.inOut" }, 0)
        .to(r, { bg: 1, duration: 0.8, ease: "power1.in" }, 0.1)
        .to(r, { lift: 1, duration: 1.9, ease: "power2.inOut" }, 0.8);
      return () => void tl.kill();
    }
    if (!played.current) return;
    if (reduced) {
      Object.assign(r, startPose());
      onClosed?.();
      return;
    }
    const tl = gsap.timeline({
      onComplete: () => {
        setLabels(false);
        onClosed?.();
      },
    });
    tl.to(r, { lift: 0, duration: 1.1, ease: "power2.inOut" }, 0)
      .to(r, { ...camOf(startPose()), duration: 2.0, ease: "power2.inOut" }, 0.2)
      .to(r, { bg: 0, duration: 0.5, ease: "power1.out" }, 1.7);
    return () => void tl.kill();
    // Only the open flag starts a shot; pose inputs are read when it does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Another floor: the camera follows the cut down or up.
  const lastFloorY = useRef(floorY);
  useEffect(() => {
    if (lastFloorY.current === floorY || !played.current) return;
    lastFloorY.current = floorY;
    const tween = gsap.to(rig.current, { ty: floorY + 0.9, duration: reduced ? 0 : 0.8, ease: "power2.inOut", overwrite: "auto" });
    return () => void tween.kill();
  }, [floorY, reduced]);

  const upper = useRef<THREE.Group>(null);
  useFrame(() => applyRig(rig.current, camera as THREE.PerspectiveCamera, size, bg.current, upper.current, mats, ground, tint, toCam, fp.w));

  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const [hover, setHover] = useState<number>();
  const pick = selected?.floor === floor ? floorUnits.findIndex((u) => u.unit === selected.unit) : -1;

  return (
    <>
      <hemisphereLight args={[dark ? "#9fb0d0" : "#fff4e6", dark ? "#3a3530" : "#b9b1a5", dark ? 0.55 : 1.25]} />
      <primitive object={lightTarget} position={[0, floorY, 0]} />
      <directionalLight
        position={[-22, floorY + 34, 16]}
        target={lightTarget}
        intensity={dark ? 0.45 : 2.3}
        color={dark ? "#b8c6e8" : "#fff1dc"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={4}
        shadow-camera-left={-fp.w * 0.75}
        shadow-camera-right={fp.w * 0.75}
        shadow-camera-top={fp.w * 0.75}
        shadow-camera-bottom={-fp.w * 0.75}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />

      <mesh rotation-x={-Math.PI / 2} position-y={-0.05} material={ground} receiveShadow>
        <circleGeometry args={[3000, 64]} />
      </mesh>

      <mesh geometry={tintGeom} material={tint} renderOrder={3} />

      {/* Floors below the cut: a glass shell with balconies. */}
      {floor > 1 && (
        <group>
          <ShellBox outline={fp.outline} y0={0} y1={floorY} mats={mats.solid} />
          <Balconies len={fp.straight - 1.2} d={fp.d} levels={floor - 1} from={1} material={mats.slab} />
        </group>
      )}

      {/* The revealed floor. */}
      <group position-y={floorY}>
        <mesh position-y={-0.13} geometry={plateGeom} material={mats.plate} receiveShadow />
        <group scale={[sx, 1, sz]} position-y={0.02}>
          <InteriorMeshes plan={plan} toCam={toCam} dark={dark} colors={colors} />
          {plan.units.map((pu) => {
            const u = floorUnits[pu.index];
            if (!u) return null;
            const { x0, z0, x1, z1 } = pu.rect;
            const cx = (x0 + x1) / 2;
            const cz = (z0 + z1) / 2;
            const isPick = pu.index === pick;
            return (
              <group key={pu.index}>
                {dark && <pointLight position={[cx, 2.1, cz]} color="#ffb067" intensity={9} distance={9} decay={1.6} />}
                {/* Hit box for the whole flat; invisible but raycast. */}
                <mesh
                  position={[cx, LOW_H / 2, cz]}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectUnit(u);
                  }}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    setHover(pu.index);
                    document.body.style.cursor = "pointer";
                  }}
                  onPointerOut={() => {
                    setHover(undefined);
                    document.body.style.cursor = "";
                  }}
                >
                  <boxGeometry args={[x1 - x0, LOW_H + 0.4, z1 - z0]} />
                  <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </mesh>
                {(isPick || hover === pu.index) && (
                  <mesh position={[cx, 0.09, cz]}>
                    <boxGeometry args={[x1 - x0 - 0.1, 0.02, z1 - z0 - 0.1]} />
                    <meshBasicMaterial color={colors.primary} transparent opacity={isPick ? 0.5 : 0.22} depthWrite={false} />
                    {isPick && (
                      <Edges scale={[1, 1, 1]} threshold={24} color={colors.primary} lineWidth={3}>
                        <boxGeometry args={[x1 - x0 - 0.1, LOW_H * 2, z1 - z0 - 0.1]} />
                      </Edges>
                    )}
                  </mesh>
                )}
                {showLabels && (
                  <Html position={[cx, LOW_H + 0.8, cz]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
                    <UnitChip unit={u} picked={isPick} />
                  </Html>
                )}
              </group>
            );
          })}
        </group>
      </group>

      {/* Everything above the revealed floor (and its own facade): lifts, slides off and fades. */}
      <group ref={upper}>
        <ShellBox outline={fp.outline} y0={floorY} y1={building.floors * FLOOR_H} mats={mats.fadingShell} />
        <Balconies len={fp.straight - 1.2} d={fp.d} levels={building.floors - floor} from={floor} material={mats.fadingSlab} />
        <RoofTop w={fp.w} d={fp.d} outline={fp.outline} y={building.floors * FLOOR_H} material={mats.fadingRoof} />
      </group>
    </>
  );
}

function UnitChip({ unit, picked }: { unit: Unit; picked: boolean }) {
  const band = BANDS[bandOf(unit.price)];
  return (
    <div
      className={
        picked
          ? "whitespace-nowrap rounded-md border-2 border-primary bg-card px-2 py-1 text-xs font-semibold text-card-foreground shadow-md"
          : "flex items-center gap-1 whitespace-nowrap rounded-full bg-card/90 px-1.5 py-0.5 text-[10px] font-medium text-card-foreground shadow-sm"
      }
    >
      {picked ? (
        <>
          Unit {unit.unit} · {unit.type} · RM{unit.price.toLocaleString()}
        </>
      ) : (
        <>
          <span className="size-2 rounded-full" style={{ background: `var(--${band.token})` }} />
          RM{Math.round(unit.price / 1000)}k
        </>
      )}
    </div>
  );
}

// Per-frame update, outside the component because three.js objects are mutated in place.
function applyRig(
  r: Rig,
  cam: THREE.PerspectiveCamera,
  size: { width: number; height: number },
  bgEl: HTMLDivElement | null,
  upper: THREE.Group | null,
  mats: { fading: THREE.Material[]; slab: THREE.Material; fadingSlab: THREE.Material },
  ground: THREE.Material,
  tint: THREE.Material,
  toCam: [number, number],
  w: number,
) {
  const b = r.bearing * D2R;
  const p = r.pitch * D2R;
  // MapLibre's camera: bearing turns the view clockwise from north, pitch tilts from straight down.
  cam.position.set(r.tx - r.dist * Math.sin(p) * Math.sin(b), r.ty + r.dist * Math.cos(p), r.tz + r.dist * Math.sin(p) * Math.cos(b));
  cam.lookAt(r.tx, r.ty, r.tz);
  if (r.off > 0.5) cam.setViewOffset(size.width, size.height, 0, r.off, size.width, size.height);
  else cam.clearViewOffset();
  cam.updateProjectionMatrix();
  if (bgEl) bgEl.style.opacity = String(r.bg);
  ground.opacity = r.bg;
  mats.slab.opacity = r.bg;
  tint.opacity = (1 - r.bg) ** 2;
  tint.visible = tint.opacity > 0.01;
  if (upper) {
    // Up, and away from the camera, so it clears the frame.
    upper.position.set(-toCam[0] * r.lift * w * 0.6, r.lift * 26, -toCam[1] * r.lift * w * 0.6);
    upper.rotation.z = r.lift * 0.06;
    const o = 1 - smooth(0.45, 0.95, r.lift);
    upper.visible = o > 0.01;
    for (const m of mats.fading) m.opacity = o;
    mats.fadingSlab.opacity = o * r.bg;
  }
}
