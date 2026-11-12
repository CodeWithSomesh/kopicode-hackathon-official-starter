"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import * as THREE from "three";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";
import { CATALOG, type Item, type Kind } from "./furniture";
import type { Floor } from "./plans";
import type { Sun } from "./sun";
import { WALL_H, WALL_T, wallPieces } from "./walls";

/**
 * The same layout as the 2D plan, in 3D. Plan x maps to world X, plan y to world Z, height
 * to world Y. The sun is a real directional light, so its patches come through the window
 * openings as shadows. Furniture is simple blocks at real sizes.
 */

type Props = {
  floor: Floor;
  bounds: { w: number; h: number };
  sun: Sun;
  items: Item[];
  selected: string | null;
  flagged: ReadonlySet<string>;
  onSelect: (uid: string | null) => void;
  onDrag: (uid: string, cx: number, cy: number) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  className?: string;
};

/** Unit vector from the plan's centre towards the camera: front-left, high above. */
const VIEW_DIR = (() => {
  const v = [-0.3, 1.45, 0.75];
  const n = Math.hypot(...v);
  return v.map((x) => x / n) as [number, number, number];
})();

type Colors = Record<
  | "ink"
  | "soft"
  | "surface"
  | "cloud"
  | "line"
  | "furniture"
  | "plant"
  | "glass"
  | "sun"
  | "raya"
  | "select"
  | "teh",
  string
>;

function readColors(el: Element): Colors {
  const css = getComputedStyle(el);
  const v = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
  return {
    ink: v("--color-ink", "#17332a"),
    soft: v("--color-ink-soft", "#4a6359"),
    surface: v("--j-surface", "#ffffff"),
    cloud: v("--color-cloud", "#e4efe8"),
    line: v("--j-line", "#c9dbd1"),
    furniture: v("--color-lilac", "#d6ebf3"),
    plant: v("--color-pandan", "#1f9d6b"),
    glass: v("--color-sky-deep", "#3f8fb5"),
    sun: v("--color-kaya", "#f2b632"),
    raya: v("--color-raya", "#d8452f"),
    select: v("--color-pandan-deep", "#12704b"),
    teh: v("--color-teh", "#8a5a33"),
  };
}

export function Plan3D(props: Props) {
  const t = useT();
  const wrap = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<Colors | null>(null);

  useEffect(() => {
    // Theme colours live in CSS; read them once the wrapper is in the themed tree.
    if (wrap.current) setColors(readColors(wrap.current));
  }, []);

  const { bounds } = props;
  const span = Math.max(bounds.w, bounds.h);
  const fit =
    Math.max(bounds.w, bounds.h) * 1.4 + Math.min(bounds.w, bounds.h) * 0.8;
  const centre: [number, number, number] = [bounds.w / 2, 0, bounds.h / 2];

  return (
    <div
      ref={wrap}
      tabIndex={0}
      onKeyDown={props.onKeyDown}
      role="application"
      aria-roledescription="3D floor plan"
      aria-label={t("3D view, {floor}. Drag to orbit, scroll to zoom. Tap a piece to select it and drag it to move.", { floor: t(props.floor.label) })}
      className={cn(
        "relative touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pandan-deep",
        props.className,
      )}
    >
      {colors ? (
        <Canvas
          shadows
          // No film tone curve: keep the Kopitiam colours as the 2D plan draws them.
          flat
          dpr={[1, 1.5]}
          camera={{
            // Steep enough to look down into the rooms over full-height walls, and far
            // enough back to fit the plan's long side plus some of its short side.
            position: [
              centre[0] + VIEW_DIR[0] * fit,
              VIEW_DIR[1] * fit,
              centre[2] + VIEW_DIR[2] * fit,
            ],
            fov: 38,
            near: 0.1,
            far: 400,
          }}
          onPointerMissed={() => props.onSelect(null)}
          gl={{ antialias: true }}
        >
          <color attach="background" args={[colors.surface]} />
          <Scene {...props} colors={colors} centre={centre} span={span} />
        </Canvas>
      ) : null}
    </div>
  );
}

function Scene({
  floor,
  sun,
  items,
  selected,
  flagged,
  onSelect,
  onDrag,
  colors,
  centre,
  span,
}: Props & { colors: Colors; centre: [number, number, number]; span: number }) {
  const walls = useMemo(() => wallPieces(floor), [floor]);
  const light = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  const controls = useRef<{ enabled: boolean } | null>(null);
  const drag = useRef<{ uid: string; dx: number; dz: number } | null>(null);
  const ground = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );

  // The light aims at the middle of the plan; its target has to be in the scene to count.
  useEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(...centre);
    scene.add(l.target);
    return () => {
      scene.remove(l.target);
    };
  }, [scene, centre]);

  // Warm the sunlight so a sunlit patch of floor reads as sun, not just "brighter".
  const sunColor = useMemo(
    () =>
      new THREE.Color(colors.surface).lerp(new THREE.Color(colors.sun), 0.75),
    [colors],
  );
  const sunPos: [number, number, number] = [
    centre[0] + sun.sx * 40,
    Math.max(0.5, sun.sz) * 40,
    centre[2] + sun.sy * 40,
  ];

  const floorPoint = (e: ThreeEvent<PointerEvent>) => {
    const hit = new THREE.Vector3();
    return e.ray.intersectPlane(ground, hit) ? hit : null;
  };

  const startDrag = (it: Item) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect(it.uid);
    if (CATALOG[it.kind].fixed) return;
    const p = floorPoint(e);
    if (!p) return;
    drag.current = { uid: it.uid, dx: it.cx - p.x, dz: it.cy - p.z };
    if (controls.current) controls.current.enabled = false;
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return;
    const p = floorPoint(e);
    if (p)
      onDrag(drag.current.uid, p.x + drag.current.dx, p.z + drag.current.dz);
  };
  const endDrag = () => {
    drag.current = null;
    if (controls.current) controls.current.enabled = true;
  };

  return (
    <>
      <hemisphereLight
        args={[colors.surface, colors.cloud, sun.up ? 1.9 : 2.2]}
      />
      <directionalLight
        ref={light}
        position={sunPos}
        intensity={sun.up ? 1.7 : 0}
        color={sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
      />

      {/* Ground around the home. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[centre[0], -0.02, centre[2]]}
        receiveShadow
      >
        <planeGeometry args={[span * 4, span * 4]} />
        <meshBasicMaterial color={colors.cloud} />
      </mesh>

      {/* Floors. */}
      {floor.rooms.map((r) => (
        <mesh
          key={r.id}
          rotation-x={-Math.PI / 2}
          position={[r.x + r.w / 2, 0, r.y + r.h / 2]}
          receiveShadow
        >
          <planeGeometry args={[r.w, r.h]} />
          <meshStandardMaterial
            color={r.kind === "outdoor" ? colors.line : colors.surface}
          />
        </mesh>
      ))}

      {/* Ceiling: invisible to the camera but casts shadow, so sun only gets in through
          windows and doors, not over the tops of the walls. */}
      {floor.rooms
        .filter((r) => r.kind !== "outdoor")
        .map((r) => (
          <mesh
            key={`ceil-${r.id}`}
            position={[r.x + r.w / 2, WALL_H + 0.05, r.y + r.h / 2]}
            castShadow
          >
            <boxGeometry args={[r.w + WALL_T, 0.1, r.h + WALL_T]} />
            <meshBasicMaterial colorWrite={false} depthWrite={false} />
          </mesh>
        ))}

      {/* Walls, sills, lintels and glass. */}
      {walls.map((w, i) => {
        const h = w.y1 - w.y0;
        const size: [number, number, number] =
          w.axis === "x"
            ? [w.len + (w.glass ? 0 : WALL_T), h, w.glass ? 0.03 : WALL_T]
            : [w.glass ? 0.03 : WALL_T, h, w.len + (w.glass ? 0 : WALL_T)];
        return (
          <mesh
            key={i}
            position={[w.x, w.y0 + h / 2, w.y]}
            castShadow={!w.glass}
            receiveShadow={!w.glass}
          >
            <boxGeometry args={size} />
            {w.glass ? (
              <meshStandardMaterial
                color={colors.glass}
                transparent
                opacity={0.18}
                depthWrite={false}
              />
            ) : (
              <meshStandardMaterial color={colors.cloud} />
            )}
          </mesh>
        );
      })}

      {/* Furniture. */}
      {items.map((it) => (
        <group
          key={it.uid}
          position={[it.cx, 0, it.cy]}
          rotation-y={(-it.rot * Math.PI) / 2}
          onPointerDown={startDrag(it)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <FurnitureModel kind={it.kind} colors={colors} />
          {it.uid === selected ? (
            <SelectionFrame kind={it.kind} color={colors.select} />
          ) : null}
          {flagged.has(it.uid) ? (
            <mesh position={[0, partsTop(it.kind) + 0.35, 0]}>
              <sphereGeometry args={[0.12, 16, 12]} />
              <meshStandardMaterial
                color={colors.raya}
                emissive={colors.raya}
                emissiveIntensity={0.4}
              />
            </mesh>
          ) : null}
        </group>
      ))}

      <OrbitControls
        ref={controls as never}
        makeDefault
        target={centre}
        enableDamping
        maxPolarAngle={1.35}
        minDistance={span * 0.4}
        maxDistance={span * 3}
      />
    </>
  );
}

/* ------------------------------------------------------------------ furniture */

type Part = {
  size: [number, number, number];
  /** Centre in item space: x along the width, z along the depth (front is +z), y up. */
  at: [number, number, number];
  tone: keyof Colors;
  shape?: "box" | "cylinder" | "sphere";
};

/** Simple block models at real sizes, built in item space before the item is rotated. */
function partsFor(kind: Kind): Part[] {
  const { w, d } = CATALOG[kind];
  const back = -d / 2;
  switch (kind) {
    case "sofa":
      return [
        { size: [w, 0.42, d], at: [0, 0.21, 0], tone: "furniture" },
        { size: [w, 0.45, 0.2], at: [0, 0.645, back + 0.1], tone: "soft" },
        { size: [0.16, 0.2, d], at: [-w / 2 + 0.08, 0.52, 0], tone: "soft" },
        { size: [0.16, 0.2, d], at: [w / 2 - 0.08, 0.52, 0], tone: "soft" },
      ];
    case "bed":
      return [
        { size: [w, 0.45, d], at: [0, 0.225, 0], tone: "furniture" },
        { size: [w, 0.65, 0.08], at: [0, 0.775, back + 0.04], tone: "soft" },
        {
          size: [w / 2 - 0.12, 0.12, 0.34],
          at: [-w / 4, 0.51, back + 0.32],
          tone: "surface",
        },
        {
          size: [w / 2 - 0.12, 0.12, 0.34],
          at: [w / 4, 0.51, back + 0.32],
          tone: "surface",
        },
      ];
    case "tv":
      return [
        { size: [w, 0.5, d], at: [0, 0.25, 0], tone: "furniture" },
        {
          size: [Math.min(1.5, w - 0.2), 0.85, 0.05],
          at: [0, 0.5 + 0.45, back + 0.1],
          tone: "ink",
        },
      ];
    case "coffee":
      return [{ size: [w, 0.4, d], at: [0, 0.2, 0], tone: "furniture" }];
    case "dining": {
      const chairs: Part[] = [-0.5, 0, 0.5].flatMap((x) => [
        {
          size: [0.4, 0.45, 0.4] as [number, number, number],
          at: [x, 0.225, -0.62] as [number, number, number],
          tone: "soft" as const,
        },
        {
          size: [0.4, 0.45, 0.4] as [number, number, number],
          at: [x, 0.225, 0.62] as [number, number, number],
          tone: "soft" as const,
        },
      ]);
      return [
        { size: [1.4, 0.75, 0.8], at: [0, 0.375, 0], tone: "teh" },
        ...chairs,
      ];
    }
    case "wardrobe":
      return [{ size: [w, 2.0, d], at: [0, 1.0, 0], tone: "furniture" }];
    case "desk":
      return [
        { size: [w, 0.75, d], at: [0, 0.375, 0], tone: "teh" },
        {
          size: [0.42, 0.45, 0.42],
          at: [0, 0.225, d / 2 + 0.25],
          tone: "soft",
        },
      ];
    case "shoerack":
      return [{ size: [w, 0.9, d], at: [0, 0.45, 0], tone: "furniture" }];
    case "stove":
      return [
        { size: [w, 0.88, d], at: [0, 0.44, 0], tone: "line" },
        { size: [0.7, 0.03, 0.45], at: [0, 0.895, 0], tone: "ink" },
      ];
    case "sink":
      return [
        { size: [w, 0.88, d], at: [0, 0.44, 0], tone: "line" },
        { size: [0.55, 0.03, 0.38], at: [0, 0.895, 0], tone: "glass" },
      ];
    case "altar":
      return [
        { size: [w, 0.9, d], at: [0, 0.45, 0], tone: "teh" },
        {
          size: [w * 0.7, 0.35, d * 0.6],
          at: [0, 1.075, back + d * 0.3],
          tone: "raya",
        },
      ];
    case "mirror":
      return [
        { size: [w, 1.5, 0.04], at: [0, 1.05, back + 0.02], tone: "glass" },
      ];
    case "plant":
      return [
        {
          size: [0.18, 0.35, 0.18],
          at: [0, 0.175, 0],
          tone: "teh",
          shape: "cylinder",
        },
        {
          size: [0.32, 0.32, 0.32],
          at: [0, 0.7, 0],
          tone: "plant",
          shape: "sphere",
        },
      ];
  }
}

const partsTop = (kind: Kind) =>
  Math.max(...partsFor(kind).map((p) => p.at[1] + p.size[1] / 2));

function FurnitureModel({ kind, colors }: { kind: Kind; colors: Colors }) {
  const parts = useMemo(() => partsFor(kind), [kind]);
  return (
    <>
      {parts.map((p, i) => (
        <mesh key={i} position={p.at} castShadow receiveShadow>
          {p.shape === "cylinder" ? (
            <cylinderGeometry
              args={[p.size[0], p.size[0] * 0.8, p.size[1], 20]}
            />
          ) : p.shape === "sphere" ? (
            <sphereGeometry args={[p.size[0], 20, 16]} />
          ) : (
            <boxGeometry args={p.size} />
          )}
          <meshStandardMaterial
            color={colors[p.tone]}
            {...(p.tone === "glass"
              ? {
                  transparent: true,
                  opacity: 0.75,
                  roughness: 0.1,
                  metalness: 0.2,
                }
              : {})}
          />
        </mesh>
      ))}
    </>
  );
}

/** A flat frame on the floor around the selected piece. */
function SelectionFrame({ kind, color }: { kind: Kind; color: string }) {
  const { w, d } = CATALOG[kind];
  const pad = 0.12;
  const t = 0.06;
  const W = w + pad * 2;
  const D = d + pad * 2;
  const bars: [number, number, number, number][] = [
    [0, -D / 2, W, t],
    [0, D / 2, W, t],
    [-W / 2, 0, t, D],
    [W / 2, 0, t, D],
  ];
  return (
    <>
      {bars.map(([x, z, sw, sd], i) => (
        <mesh key={i} position={[x, 0.015, z]}>
          <boxGeometry args={[sw, 0.02, sd]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      {/* Front marker, so the facing reads in 3D too. */}
      <mesh position={[0, 0.02, D / 2 + 0.16]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.1, 3]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </>
  );
}
