"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ThemeColors } from "../use-theme-colors";
import { FLOOR_H, LOW_H, PALETTE, WALL_H, WALL_T, roomFloor, type FloorPlan } from "./layout";

// ---------- glass facade (shell above and below the cut) ----------

const TEX_W = 6; // metres across the texture: 4 panes of 1.5 m
const TEX_FLOORS = 4;

const mix = (a: string, b: string, t: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

/** Window grid drawn on a canvas from theme tokens. The emissive twin lights about a fifth of the panes at night. */
function facadeTextures(colors: ThemeColors, dark: boolean) {
  const W = 512;
  const H = 1024;
  const rowH = H / TEX_FLOORS;
  const paneW = W / 4;
  const base = document.createElement("canvas");
  const glow = document.createElement("canvas");
  base.width = glow.width = W;
  base.height = glow.height = H;
  const g = base.getContext("2d")!;
  const e = glow.getContext("2d")!;
  // Close to the map's glass texture (chart-3 into the background), so the crossfade from the map holds.
  const glassTop = dark ? mix(colors["chart-3"], colors.background, 0.55) : mix(colors["chart-3"], colors.background, 0.3);
  const glassLow = dark ? mix(colors["chart-3"], colors.background, 0.75) : mix(colors["chart-3"], colors.foreground, 0.15);
  const frame = dark ? "#3b4048" : "#ece8e1";
  const mullion = dark ? "#23272d" : "#5c646d";
  g.fillStyle = frame;
  g.fillRect(0, 0, W, H);
  e.fillStyle = "#000";
  e.fillRect(0, 0, W, H);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let r = 0; r < TEX_FLOORS; r++) {
    const y = r * rowH;
    for (let c = 0; c < 4; c++) {
      const x = c * paneW;
      const grad = g.createLinearGradient(0, y, 0, y + rowH);
      grad.addColorStop(0, glassTop);
      grad.addColorStop(1, glassLow);
      g.fillStyle = grad;
      g.fillRect(x + 5, y + 10, paneW - 10, rowH * 0.8);
      g.fillStyle = mullion;
      g.fillRect(x, y, 5, rowH);
      // a soft sky glint across the upper pane
      g.fillStyle = dark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.22)";
      g.fillRect(x + 5, y + 10, paneW - 10, rowH * 0.18);
      if (rand() < 0.22) {
        const warm = e.createLinearGradient(0, y, 0, y + rowH);
        warm.addColorStop(0, "#ffcf8a");
        warm.addColorStop(1, "#d98a3c");
        e.fillStyle = warm;
        e.fillRect(x + 5, y + 10, paneW - 10, rowH * 0.8);
      }
    }
    // slab edge band at the bottom of each floor
    g.fillStyle = dark ? "#4a5059" : "#f6f3ee";
    g.fillRect(0, y + rowH * 0.9, W, rowH * 0.1);
  }
  const make = (cv: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: make(base, true), emissiveMap: make(glow, true) };
}

export function glassMaterials(colors: ThemeColors, dark: boolean) {
  const { map, emissiveMap } = facadeTextures(colors, dark);
  const side = new THREE.MeshStandardMaterial({
    map,
    emissiveMap,
    emissive: "#ffffff",
    emissiveIntensity: dark ? 1.1 : 0,
    roughness: 0.25,
    metalness: 0.15,
  });
  const roof = new THREE.MeshStandardMaterial({ color: dark ? "#4d525a" : "#e8e4dd", roughness: 0.9 });
  // balconies are not on the map's blocks: they fade in with the 3D background (transparent from the start)
  const slab = new THREE.MeshStandardMaterial({ color: dark ? "#555b64" : "#f4f1ec", roughness: 0.8, transparent: true, opacity: 0 });
  const fade = (m: THREE.MeshStandardMaterial) => {
    const c = m.clone();
    c.transparent = true;
    return c;
  };
  const fSide = fade(side);
  const fRoof = fade(roof);
  const fSlab = fade(slab);
  return {
    solid: [side, side, roof, roof, side, side],
    fadingShell: [fSide, fSide, fRoof, fRoof, fSide, fSide],
    slab,
    fadingSlab: fSlab,
    fadingRoof: fRoof,
    fading: [fSide, fRoof] as THREE.Material[],
    plate: new THREE.MeshStandardMaterial({ color: dark ? "#6b6862" : PALETTE.corridor, roughness: 0.85 }),
  };
}

/** A box whose side UVs are in texture tiles (6 m by 4 floors), so the window grid keeps its real size on any block. */
export function ShellBox({ w, d, y0, y1, mats }: { w: number; d: number; y0: number; y1: number; mats: THREE.Material[] }) {
  const h = y1 - y0;
  const geom = useMemo(() => {
    const g = new THREE.BoxGeometry(w, Math.max(h, 0.01), d);
    const uv = g.getAttribute("uv") as THREE.BufferAttribute;
    // face order: +x, -x, +y, -y, +z, -z; 4 vertices each
    for (let f = 0; f < 6; f++) {
      const across = f < 2 ? d : w;
      const up = f === 2 || f === 3 ? d : h;
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, (uv.getX(i) * across) / TEX_W, (uv.getY(i) * up) / (TEX_FLOORS * FLOOR_H));
      }
    }
    return g;
  }, [w, d, h]);
  if (h <= 0.01) return null;
  return <mesh geometry={geom} material={mats} position-y={y0 + h / 2} />;
}

/** One balcony slab per floor on both long facades, instanced. */
export function Balconies({ w, d, levels, from, material }: { w: number; d: number; levels: number; from: number; material: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => new RoundedBoxGeometry(w - 2.4, 0.16, 0.9, 2, 0.05), [w]);
  const count = Math.max(0, levels) * 2;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < levels; i++) {
      for (const s of [0, 1]) {
        m.makeTranslation(0, (from + i) * FLOOR_H - 0.09, (s ? 1 : -1) * (d / 2 + 0.45));
        mesh.setMatrixAt(i * 2 + s, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [levels, from, d, count]);
  if (count === 0) return null;
  return <instancedMesh key={count} ref={ref} args={[geom, material, count]} />;
}

export function RoofTop({ w, d, y, material }: { w: number; d: number; y: number; material: THREE.Material }) {
  const geoms = useMemo(
    () => ({
      slab: new RoundedBoxGeometry(w + 0.6, 0.55, d + 0.6, 3, 0.18),
      plant: new RoundedBoxGeometry(Math.min(8, w * 0.3), 2.4, Math.min(5, d * 0.3), 2, 0.12),
      tank: new RoundedBoxGeometry(3, 1.8, 3, 2, 0.1),
    }),
    [w, d],
  );
  return (
    <group position-y={y}>
      <mesh geometry={geoms.slab} material={material} position-y={0.27} />
      <mesh geometry={geoms.plant} material={material} position={[-w * 0.18, 1.7, 0]} />
      <mesh geometry={geoms.tank} material={material} position={[w * 0.22, 1.4, d * 0.1]} />
    </group>
  );
}

// ---------- the revealed floor ----------

const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, r = 0) => {
  const g = r > 0 ? new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(r, sx / 2, sy / 2, sz / 2)) : new THREE.BoxGeometry(sx, sy, sz);
  g.translate(x, y, z);
  // merged geometries need matching attributes; RoundedBox has no groups/index differences that matter after this
  if (g.index) return g.toNonIndexed();
  return g;
};

const merge = (parts: THREE.BufferGeometry[]) => (parts.length ? mergeGeometries(parts, false) : null);

/**
 * Rooms, walls, glazing and furniture of one floor, merged into a few meshes (one per material).
 * The dollhouse cut: outer walls facing away from the camera stand full height as glass; every other wall is a third high.
 */
export function InteriorMeshes({ plan, toCam, dark }: { plan: FloorPlan; toCam: [number, number]; dark: boolean }) {
  const built = useMemo(() => {
    const floors: Record<string, THREE.BufferGeometry[]> = {};
    const add = (k: string, g: THREE.BufferGeometry) => (floors[k] ??= []).push(g);
    for (const u of plan.units) {
      const { x0, z0, x1, z1 } = u.rect;
      add("wood", box(x1 - x0, 0.03, z1 - z0, (x0 + x1) / 2, 0.015, (z0 + z1) / 2));
      for (const r of u.rooms) {
        const rc = r.rect;
        add(roomFloor(r.id), box(rc.x1 - rc.x0 - 0.02, 0.05, rc.z1 - rc.z0 - 0.02, (rc.x0 + rc.x1) / 2, 0.035, (rc.z0 + rc.z1) / 2));
      }
    }
    const low: THREE.BufferGeometry[] = [];
    const glass: THREE.BufferGeometry[] = [];
    const frame: THREE.BufferGeometry[] = [];
    for (const wl of plan.walls) {
      const len = Math.hypot(wl.x1 - wl.x0, wl.z1 - wl.z0);
      if (len < 0.05) continue;
      const alongX = Math.abs(wl.z1 - wl.z0) < 1e-6;
      const mx = (wl.x0 + wl.x1) / 2;
      const mz = (wl.z0 + wl.z1) / 2;
      const far = wl.nx * toCam[0] + wl.nz * toCam[1] < 0;
      const [sx, sz] = alongX ? [len, WALL_T] : [WALL_T, len];
      if (wl.outer && far) {
        // curtain wall: glass with mullions every ~1.2 m, a sill and a head
        glass.push(box(alongX ? len : 0.03, WALL_H - 0.1, alongX ? 0.03 : len, mx, WALL_H / 2, mz));
        frame.push(box(sx + 0.02, 0.12, sz + 0.02, mx, 0.06, mz), box(sx + 0.02, 0.1, sz + 0.02, mx, WALL_H - 0.05, mz));
        const n = Math.max(1, Math.round(len / 1.2));
        for (let i = 0; i <= n; i++) {
          const t = i / n - 0.5;
          frame.push(box(alongX ? 0.06 : 0.1, WALL_H, alongX ? 0.1 : 0.06, mx + (alongX ? t * len : 0), WALL_H / 2, mz + (alongX ? 0 : t * len)));
        }
      } else {
        low.push(box(sx, LOW_H, sz, mx, LOW_H / 2, mz, 0.04));
      }
    }
    const furniture: Record<string, THREE.BufferGeometry[]> = {};
    for (const u of plan.units)
      for (const f of u.furniture) (furniture[f.color] ??= []).push(box(f.sx, f.sy, f.sz, f.x, f.y + f.sy / 2 + 0.06, f.z, f.r ?? 0.05));

    const mat = (color: string, extra?: THREE.MeshStandardMaterialParameters) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    return {
      floors: Object.entries(floors).map(([k, g]) => ({ k, geom: merge(g), mat: mat(PALETTE[k as keyof typeof PALETTE], { roughness: k === "tile" ? 0.4 : 0.8 }) })),
      low: { geom: merge(low), mat: mat(PALETTE.wall, { roughness: 0.9 }) },
      glass: {
        geom: merge(glass),
        mat: new THREE.MeshStandardMaterial({ color: dark ? "#2d3f52" : "#b9d3e2", transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.3, depthWrite: false }),
      },
      frame: { geom: merge(frame), mat: mat("#59616a", { roughness: 0.5, metalness: 0.4 }) },
      furniture: Object.entries(furniture).map(([k, g]) => ({
        k,
        geom: merge(g),
        mat: mat(PALETTE[k as keyof typeof PALETTE], k === "lamp" ? { emissive: "#ffb867", emissiveIntensity: dark ? 2.5 : 0.3 } : undefined),
      })),
    };
  }, [plan, toCam, dark]);

  return (
    <>
      {built.floors.map((f) => f.geom && <mesh key={f.k} geometry={f.geom} material={f.mat} receiveShadow />)}
      {built.low.geom && <mesh geometry={built.low.geom} material={built.low.mat} castShadow receiveShadow />}
      {built.frame.geom && <mesh geometry={built.frame.geom} material={built.frame.mat} castShadow />}
      {built.glass.geom && <mesh geometry={built.glass.geom} material={built.glass.mat} renderOrder={2} />}
      {built.furniture.map((f) => f.geom && <mesh key={f.k} geometry={f.geom} material={f.mat} castShadow receiveShadow />)}
    </>
  );
}
