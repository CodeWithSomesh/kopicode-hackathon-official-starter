"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { gsap } from "gsap";
import { houseById, type Group, type House } from "@/lib/first-key/landed";
import { useThemeColors, type ThemeColors } from "../use-theme-colors";
import { usePrefersReducedMotion } from "../use-reduced-motion";
import { FLOOR_H, LOW_H } from "./layout";
import { InteriorMeshes, plateMaterial, slabGeom } from "./dollhouse";
import { LROLES, groupSpec, landedFrame, landedMaterials, landedParts, type LRole, type LandedSpec } from "../tower/landed-model";
import { landedPlan } from "./landed-plan";
import type { MapView } from "./map-view";

/**
 * The burst for a landed group (a terrace row, a semi-D pair, a bungalow): the same shot as the tower's (the map's pose, then the
 * three-quarter view), with the storeys lifting apart instead of floors. The storey slider cuts the group: storeys above lift away,
 * the cut storey shows its rooms, one house is picked (its plan highlighted); tap a house for its card.
 */
const END_PITCH = 50;
const SHOT_S = 3;
const HOLD_S = 0.35;
const D2R = Math.PI / 180;

type Props = {
  group: Group;
  selectedHouseId?: string;
  onSelectHouse: (house: House) => void;
  active: boolean;
  open: boolean;
  view?: MapView;
  onClosed?: () => void;
};

type Rig = { bearing: number; pitch: number; dist: number; tx: number; ty: number; tz: number; off: number; bg: number; lift: number };
const camOf = (r: Rig) => ({ bearing: r.bearing, pitch: r.pitch, dist: r.dist, tx: r.tx, ty: r.ty, tz: r.tz, off: r.off });
const isDark = (rgb: string) => (rgb.match(/\d+/g) ?? ["255"]).slice(0, 3).reduce((t, v) => t + Number(v), 0) / 3 < 128;
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rm = (n: number) => `RM${n.toLocaleString("en-MY")}`;

export function LandedBurst({ group, selectedHouseId, onSelectHouse, active, open, view, onClosed }: Props) {
  const reduced = usePrefersReducedMotion();
  const colors = useThemeColors();
  const spec = useMemo(() => groupSpec(group), [group]);
  const houses = useMemo(() => group.houses.map((id) => houseById(id)!), [group]);
  const selected = houses.find((h) => h.id === selectedHouseId);
  const N = spec.storeys;
  const [storey, setStorey] = useState(N); // the cut: the top storey first, so the roof comes off
  const bg = useRef<HTMLDivElement>(null);
  const label = selected?.storeys[Math.min(storey - 1, selected.storeys.length - 1)]?.label ?? houses[0].storeys[Math.min(storey - 1, houses[0].storeys.length - 1)].label;

  return (
    <div className="relative h-full w-full select-none">
      <div ref={bg} className="absolute inset-0 bg-background opacity-0" />
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        shadows="percentage"
        dpr={[1, 1.5]}
        frameloop={active ? "always" : "demand"}
        camera={{ fov: view?.fov ?? 36.87, near: 1, far: 5000, position: [0, 300, 300] }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1 }}
        aria-label={`3D view of ${group.id}, storey ${storey}`}
      >
        <Scene group={group} spec={spec} houses={houses} colors={colors} storey={storey} reduced={reduced} open={open} view={view} onClosed={onClosed} bg={bg} selected={selected} onSelectHouse={onSelectHouse} />
      </Canvas>

      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-x-6 gap-y-2 border-t bg-card/90 px-4 py-3 text-card-foreground backdrop-blur max-lg:pb-[112px]">
        {N > 1 && (
          <label className="flex min-w-48 flex-1 items-center gap-3 text-sm">
            <span className="shrink-0 font-medium tabular-nums">
              Storey {storey} <span className="text-muted-foreground">of {N}</span>
            </span>
            <input type="range" min={1} max={N} step={1} value={storey} onChange={(e) => setStorey(Number(e.target.value))} className="w-full accent-[var(--primary)]" aria-label="Storey to open" />
          </label>
        )}
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="w-full text-sm" aria-live="polite">
          {selected ? (
            <>
              <strong>Lot {selected.lotNo}</strong>: {selected.label}, {selected.builtUpSqft.toLocaleString()} sqft built-up on {selected.landSqft.toLocaleString()} sqft of land, {selected.beds} bed {selected.baths} bath, {selected.parking} car porch, {rm(selected.price)} (about {rm(selected.monthly)} a month), front faces {selected.facing}
            </>
          ) : (
            <span className="text-muted-foreground">Tap a house to see it. Move the storey slider to lift the storeys above away.</span>
          )}
        </p>
      </div>
    </div>
  );
}

function Scene({ group, spec, houses, colors, storey, reduced, open, view, onClosed, bg, selected, onSelectHouse }: {
  group: Group;
  spec: LandedSpec;
  houses: House[];
  colors: ThemeColors;
  storey: number;
  reduced: boolean;
  open: boolean;
  view?: MapView;
  onClosed?: () => void;
  bg: React.RefObject<HTMLDivElement | null>;
  selected?: House;
  onSelectHouse: (house: House) => void;
}) {
  const { camera, size } = useThree();
  const dark = isDark(colors.background);
  const N = spec.storeys;
  const frame = useMemo(() => landedFrame(spec), [spec]);
  const kx = 111_320 * Math.cos(group.lat * D2R);
  const kz = 110_574;
  const floorY = (storey - 1) * FLOOR_H;
  const heading = -group.rot * D2R; // group.rot is clockwise on the map; three.js turns counter-clockwise for a positive y rotation

  const b0 = view?.bearing ?? -20;
  const b1 = Math.round((b0 - 45) / 90) * 90 + 45;
  const toCamWorld = useMemo<[number, number]>(() => [-Math.sin(b1 * D2R), Math.cos(b1 * D2R)], [b1]);
  // the plan and the walls live in the model's frame, which is the world's turned by the group's heading
  const toCam = useMemo<[number, number]>(() => [toCamWorld[0] * Math.cos(heading) - toCamWorld[1] * Math.sin(heading), toCamWorld[0] * Math.sin(heading) + toCamWorld[1] * Math.cos(heading)], [heading, toCamWorld]);

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

  const mats = useMemo(() => {
    const solid = landedMaterials(colors, dark, true);
    const fading = Object.fromEntries(
      LROLES.map((r) => {
        const m = solid[r].clone();
        m.userData.base = m.opacity;
        m.transparent = true;
        return [r, m];
      }),
    ) as Record<LRole, THREE.Material>;
    return { solid, fading, fadingList: Object.values(fading), plate: plateMaterial(colors, dark) };
  }, [colors, dark]);
  const lower = useMemo(() => (storey > 1 ? landedParts(spec, colors, dark, { from: 0, to: storey - 1, roof: false }) : {}), [spec, colors, dark, storey]);
  const upperParts = useMemo(() => landedParts(spec, colors, dark, { from: storey - 1, to: N, roof: true }), [spec, colors, dark, storey, N]);
  // The map paints the picked house in the primary colour: this house's volume starts that colour and clears to the model.
  const tint = useMemo(() => new THREE.MeshLambertMaterial({ color: colors.primary, transparent: true, opacity: 0, depthWrite: false }), [colors.primary]);
  const plan = useMemo(() => landedPlan(spec, group, houses, storey - 1), [spec, group, houses, storey]);
  const plateGeom = useMemo(() => slabGeom(spec.w + 0.5, 0.3, frame.bd + 0.5, 0.15), [spec.w, frame.bd]);
  const ground = useMemo(() => new THREE.MeshStandardMaterial({ color: colors.muted, transparent: true, opacity: 0, roughness: 1 }), [colors.muted]);

  const endPose = () => {
    const r = 0.5 * Math.hypot(spec.w, spec.d) * 0.92;
    const t = Math.tan(((view?.fov ?? 36.87) * D2R) / 2);
    const usable = Math.max(0.4, (size.height - 190 - (size.width < 1024 ? 100 : 0)) / size.height);
    const dist = r / Math.min(t * usable, t * (size.width / size.height) * 0.9);
    return { bearing: b1, pitch: END_PITCH, dist, tx: 0, ty: floorY + 0.9, tz: 0, off: 40, bg: 1, lift: 1 };
  };
  const startPose = (): Rig =>
    view
      ? { bearing: view.bearing, pitch: view.pitch, dist: view.distanceM, tx: (view.center[0] - group.lng) * kx, ty: 0, tz: -(view.center[1] - group.lat) * kz, off: 0, bg: 0, lift: 0 }
      : { ...endPose(), bearing: b1 - 35, pitch: 60, dist: endPose().dist * 3, ty: 4, lift: 0, off: 0 };

  const rig = useRef<Rig>({ bearing: 0, pitch: 60, dist: 300, tx: 0, ty: 0, tz: 0, off: 0, bg: 0, lift: 0 });
  const played = useRef(false);
  const [labels, setLabels] = useState(false);
  const [labelReady, setLabelReady] = useState(false); // drei's Html mounts its own root: wait one tick (StrictMode double mount)
  useEffect(() => {
    const t = setTimeout(() => setLabelReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  const showLabels = labelReady && open && (reduced || labels);

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
    // only the open flag starts a shot; pose inputs are read when it does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lastFloorY = useRef(floorY);
  useEffect(() => {
    if (lastFloorY.current === floorY || !played.current) return;
    lastFloorY.current = floorY;
    const tween = gsap.to(rig.current, { ty: floorY + 0.9, duration: reduced ? 0 : 0.8, ease: "power2.inOut", overwrite: "auto" });
    return () => void tween.kill();
  }, [floorY, reduced]);

  const upper = useRef<THREE.Group>(null);
  useFrame(() => applyRig(rig.current, camera as THREE.PerspectiveCamera, size, bg.current, upper.current, mats, ground, tint, toCamWorld, spec.w));

  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const [hover, setHover] = useState<number>();
  const pick = selected ? houses.findIndex((h) => h.id === selected.id) : -1;
  const pickH = selected ? selected.heightM : 0;
  const unit = plan.units[Math.max(pick, 0)]?.rect;
  const zMid = frame.zc;

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
        shadow-camera-left={-spec.w * 0.75}
        shadow-camera-right={spec.w * 0.75}
        shadow-camera-top={spec.w * 0.75}
        shadow-camera-bottom={-spec.w * 0.75}
        shadow-camera-near={1}
        shadow-camera-far={160}
      />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05} material={ground} receiveShadow>
        <circleGeometry args={[3000, 64]} />
      </mesh>

      {/* the picked house's volume in the map's primary colour, clearing to the model as the camera leaves the map */}
      {selected && unit && (
        <group rotation-y={heading}>
          <mesh position={[(unit.x0 + unit.x1) / 2, pickH / 2, (unit.z0 + unit.z1) / 2]} material={tint} renderOrder={3}>
            <boxGeometry args={[unit.x1 - unit.x0, pickH, unit.z1 - unit.z0]} />
          </mesh>
        </group>
      )}

      <group rotation-y={heading}>
        {/* Storeys below the cut. */}
        {storey > 1 && <Meshes parts={lower} mats={mats.solid} />}

        {/* The revealed storey. */}
        <group position-y={floorY}>
          <mesh position={[0, -0.13, zMid]} geometry={plateGeom} material={mats.plate} receiveShadow />
          <group position-y={0.02}>
            <InteriorMeshes plan={plan} toCam={toCam} dark={dark} colors={colors} />
            {plan.units.map((pu) => {
              const h = houses[pu.index];
              const { x0, z0, x1, z1 } = pu.rect;
              const cx = (x0 + x1) / 2;
              const cz = (z0 + z1) / 2;
              const isPick = pu.index === pick;
              return (
                <group key={pu.index}>
                  {dark && <pointLight position={[cx, 2.1, cz]} color="#ffb067" intensity={9} distance={9} decay={1.6} />}
                  <mesh
                    position={[cx, LOW_H / 2, cz]}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectHouse(h);
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
                      <Chip house={h} picked={isPick} />
                    </Html>
                  )}
                </group>
              );
            })}
          </group>
        </group>
      </group>

      {/* The storeys above the cut (and the cut storey's own shell): lift, slide off and fade. */}
      <group ref={upper}>
        <group rotation-y={heading}>
          <Meshes parts={upperParts} mats={mats.fading} />
        </group>
      </group>
    </>
  );
}

function Meshes({ parts, mats }: { parts: Partial<Record<LRole, THREE.BufferGeometry>>; mats: Record<LRole, THREE.Material> }) {
  return LROLES.map((r) => parts[r] && <mesh key={r} geometry={parts[r]} material={mats[r]} castShadow={r !== "rail"} receiveShadow renderOrder={r === "rail" ? 2 : 0} />);
}

function Chip({ house, picked }: { house: House; picked: boolean }) {
  return (
    <div
      className={
        picked
          ? "whitespace-nowrap rounded-md border-2 border-primary bg-card px-2 py-1 text-xs font-semibold text-card-foreground shadow-md"
          : "whitespace-nowrap rounded-full bg-card/90 px-1.5 py-0.5 text-[10px] font-medium text-card-foreground shadow-sm"
      }
    >
      {picked ? `Lot ${house.lotNo} · ${house.beds}R${house.baths}B · ${rm(house.price)}` : `${house.lotNo} · RM${Math.round(house.price / 1000)}k`}
    </div>
  );
}

function applyRig(
  r: Rig,
  cam: THREE.PerspectiveCamera,
  size: { width: number; height: number },
  bgEl: HTMLDivElement | null,
  upper: THREE.Group | null,
  mats: { fadingList: THREE.Material[] },
  ground: THREE.Material,
  tint: THREE.Material,
  toCam: [number, number],
  w: number,
) {
  const b = r.bearing * D2R;
  const p = r.pitch * D2R;
  cam.position.set(r.tx - r.dist * Math.sin(p) * Math.sin(b), r.ty + r.dist * Math.cos(p), r.tz + r.dist * Math.sin(p) * Math.cos(b));
  cam.lookAt(r.tx, r.ty, r.tz);
  if (r.off > 0.5) cam.setViewOffset(size.width, size.height, 0, r.off, size.width, size.height);
  else cam.clearViewOffset();
  cam.updateProjectionMatrix();
  if (bgEl) bgEl.style.opacity = String(r.bg);
  ground.opacity = r.bg;
  tint.opacity = (1 - r.bg) ** 2;
  tint.visible = tint.opacity > 0.01;
  if (upper) {
    upper.position.set(-toCam[0] * r.lift * w * 0.6, r.lift * 26, -toCam[1] * r.lift * w * 0.6);
    upper.rotation.z = r.lift * 0.06;
    const o = 1 - smooth(0.45, 0.95, r.lift);
    upper.visible = o > 0.01;
    for (const m of mats.fadingList) m.opacity = o * (m.userData.base ?? 1);
  }
}
