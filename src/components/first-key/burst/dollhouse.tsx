"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ThemeColors } from "../use-theme-colors";
import { LOW_H, WALL_H, WALL_T, roomFloor, type FloorPlan, type PaletteKey } from "./layout";

/**
 * Interior colours mixed from theme tokens, so a theme change recolours the rooms. Mixed towards a light "paper"
 * in both modes (in dark that is the light foreground): the rooms stay a lit architectural model; dark mode
 * darkens them with the lighting, not the paint.
 */
export function paletteFrom(c: ThemeColors, dark: boolean): Record<PaletteKey, string> {
  const paper = dark ? c.foreground : c.background;
  const card = dark ? c.foreground : c.card;
  return {
    wall: mix(card, paper, 0.5),
    wood: mix(c["chart-2"], paper, 0.38),
    tile: mix(c.muted, paper, 0.35),
    carpet: mix(c["chart-4"], paper, 0.65),
    corridor: mix(c["muted-foreground"], paper, 0.6),
    sofa: mix(c["chart-3"], paper, 0.3),
    cushion: mix(c["chart-2"], paper, 0.7),
    darkWood: mix(c.primary, c["chart-2"], 0.4),
    table: mix(c["chart-2"], c.primary, 0.3),
    chair: mix(card, c["chart-4"], 0.15),
    counter: card,
    counterTop: mix(c["muted-foreground"], paper, 0.4),
    fridge: mix(c.muted, card, 0.5),
    bed: card,
    blanket: mix(c["chart-1"], paper, 0.35),
    blanket2: mix(c["chart-3"], paper, 0.55),
    rug: mix(c["chart-4"], paper, 0.45),
    lamp: mix(c["chart-2"], card, 0.5),
  };
}

const mix = (a: string, b: string, t: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();

/** Floor plates: a waxed finish (harvest values). */
const GLOSS = { roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.28 } as const;

/** The revealed floor's plate (the shell above and below the cut is tower/tower-model.ts). */
export function plateMaterial(colors: ThemeColors, dark: boolean) {
  return new THREE.MeshPhysicalMaterial({ color: mix(paletteFrom(colors, dark).corridor, colors.background, dark ? 0.35 : 0), ...GLOSS });
}

/** A rounded slab (floor plate): a RoundedBox, bevelled all round. */
export function slabGeom(w: number, h: number, d: number, r: number) {
  return new RoundedBoxGeometry(w, h, d, 2, r);
}

// ---------- the revealed floor ----------

const box = (sx: number, sy: number, sz: number, x: number, y: number, z: number, r = 0) => {
  const g = r > 0 ? new RoundedBoxGeometry(sx, sy, sz, r <= 0.03 ? 1 : 2, Math.min(r, sx / 2, sy / 2, sz / 2)) : new THREE.BoxGeometry(sx, sy, sz);
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
export function InteriorMeshes({
  plan,
  toCam,
  dark,
  colors,
}: {
  plan: FloorPlan;
  toCam: [number, number];
  dark: boolean;
  colors: ThemeColors;
}) {
  const built = useMemo(() => {
    const P = paletteFrom(colors, dark);
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
        frame.push(box(sx + 0.02, 0.12, sz + 0.02, mx, 0.06, mz, 0.02), box(sx + 0.02, 0.1, sz + 0.02, mx, WALL_H - 0.05, mz, 0.02));
        const n = Math.max(1, Math.round(len / 1.2));
        for (let i = 0; i <= n; i++) {
          const t = i / n - 0.5;
          frame.push(box(alongX ? 0.06 : 0.1, WALL_H, alongX ? 0.1 : 0.06, mx + (alongX ? t * len : 0), WALL_H / 2, mz + (alongX ? 0 : t * len), 0.02));
        }
      } else {
        low.push(box(sx, LOW_H, sz, mx, LOW_H / 2, mz, 0.05));
      }
    }
    const furniture: Record<string, THREE.BufferGeometry[]> = {};
    for (const u of plan.units)
      for (const f of u.furniture) (furniture[f.color] ??= []).push(box(f.sx, f.sy, f.sz, f.x, f.y + f.sy / 2 + 0.06, f.z, f.r ?? 0.05));

    const mat = (color: string, extra?: THREE.MeshStandardMaterialParameters) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    return {
      floors: Object.entries(floors).map(([k, g]) => ({ k, geom: merge(g), mat: mat(P[k as PaletteKey], { roughness: k === "tile" ? 0.4 : 0.8 }) })),
      low: { geom: merge(low), mat: mat(P.wall, { roughness: 0.9 }) },
      glass: {
        geom: merge(glass),
        mat: new THREE.MeshPhysicalMaterial({ color: mix(colors["chart-3"], dark ? colors.background : colors.card, dark ? 0.6 : 0.7), transparent: true, opacity: 0.32, roughness: 0.04, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false }),
      },
      frame: { geom: merge(frame), mat: new THREE.MeshPhysicalMaterial({ color: mix(colors.foreground, colors["muted-foreground"], 0.5), roughness: 0.22, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05 }) },
      furniture: Object.entries(furniture).map(([k, g]) => ({
        k,
        geom: merge(g),
        mat: mat(P[k as PaletteKey], k === "lamp" ? { emissive: P.lamp, emissiveIntensity: dark ? 2.5 : 0.3 } : undefined),
      })),
    };
  }, [plan, toCam, dark, colors]);

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
