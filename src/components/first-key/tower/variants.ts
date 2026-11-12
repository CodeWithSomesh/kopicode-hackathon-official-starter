import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { Building } from "@/lib/first-key/types";
import { parseVariant, type VariantType } from "@/lib/first-key/site-layout";
import type { ThemeColors } from "../use-theme-colors";
import { FLOOR_H } from "../burst/layout";
import { ROLES, towerMaterials, towerParts, type Design, type Facade, type P, type Role, type TowerParts } from "./tower-model";
import { mallParts, shoplotParts } from "./commercial-model";
import { landedParts, landedMaterials } from "./landed-model";

/**
 * Spawned site buildings (ILLUSTRATIVE, see lib/first-key/site-layout.ts): one glb per variant key, shared by every
 * point that uses it on Mapbox's model layer. Model frame: metres, origin at the footprint centre on the ground,
 * x = w (along the row, east at rot 0), z = d (street front at +z, south at rot 0), y up.
 */

type Size = { w: number; d: number; h: number };
const LANDED: VariantType[] = ["terrace", "superlink", "link", "townhouse", "cluster", "semid", "bungalow", "clubhouse"];

// Frontage per unit and depth for the row types; whole footprint for the single buildings. Typical Klang Valley sizes.
const ROW: Partial<Record<VariantType, { unit: number; d: number; n: number }>> = {
  terrace: { unit: 6.5, d: 22, n: 6 },
  link: { unit: 6.1, d: 21, n: 6 },
  superlink: { unit: 7.6, d: 25, n: 5 },
  townhouse: { unit: 7, d: 17, n: 4 },
  shoplot: { unit: 6.5, d: 22, n: 8 },
};
const SINGLE: Partial<Record<VariantType, { w: number; d: number }>> = {
  semid: { w: 24, d: 18 },
  cluster: { w: 20, d: 24 },
  bungalow: { w: 16, d: 20 },
  clubhouse: { w: 32, d: 26 },
  office: { w: 40, d: 28 },
  mall: { w: 100, d: 60 },
  tower: { w: 34, d: 22 },
};

/**
 * The layout lane's planned keys (2nd-brain sites/VARIANTS.txt, 02:45): every placed instance of a key uses exactly
 * these w (along the row) x d x h, so the model is built at them. Other keys fall back to typical sizes below.
 */
const PLANNED: Record<string, [number, number, number]> = {
  "terrace-2-gable-6": [39, 20, 9], "terrace-2-gable-8": [52, 20, 9], "terrace-3-gable-6": [39, 20, 12],
  "link-2-gable-4": [30, 20, 9], "superlink-2-gable-6": [47, 24, 9], "townhouse-3-flat-6": [42, 16, 12],
  "cluster-2-hip": [24, 22, 9], "cluster-3-hip": [24, 22, 12], "semid-2-hip": [26, 14, 9], "semid-3-hip": [26, 14, 12],
  "bungalow-2-hip": [15, 18, 9], "bungalow-3-hip": [15, 18, 12], "shoplot-2-flat-8": [52, 22, 9], "shoplot-3-flat-8": [52, 24, 13],
  "office-9-curtain": [40, 30, 34], "mall-3-flat": [90, 60, 15], "clubhouse-2-flat": [30, 20, 9],
  "tower-10-balcony": [36, 20, 31], "tower-25-balcony": [40, 22, 78], "tower-27-balcony": [40, 22, 84], "tower-30-balcony": [40, 22, 93],
  "tower-31-fins": [42, 22, 96], "tower-33-curtain": [42, 24, 102], "tower-42-column": [44, 26, 130], "tower-46-column": [44, 26, 143],
};

/** The model's w axis (along the row) points east at model-rotation 0: bearing 90. A row whose w runs at bearing `rot`
 * (clockwise from north, as site-layout.json gives it) needs model-rotation rot - MODEL_W_BEARING. */
export const MODEL_W_BEARING = 90;

/** The footprint and height a key's model is built at. */
export function variantSize(key: string): Size {
  const planned = PLANNED[key];
  if (planned) return { w: planned[0], d: planned[1], h: planned[2] };
  const v = parseVariant(key);
  const row = ROW[v.type];
  const { w, d } = row ? { w: (v.n ?? row.n) * row.unit, d: row.d } : SINGLE[v.type]!;
  const h =
    v.type === "shoplot" ? 4.2 + (v.storeys - 1) * 3.6 + 1.1
    : v.type === "mall" ? v.storeys * 5 + 1.4
    : v.type === "tower" || v.type === "office" ? v.storeys * FLOOR_H + 4.4
    : v.storeys * 3.3 + 3;
  return { w, d, h };
}

/** A w x d rectangle with chamfered corners, as the towers' footprints are. */
const chamfered = (w: number, d: number, c: number): P[] => {
  const [x, z] = [w / 2, d / 2];
  return [[-x + c, -z], [x - c, -z], [x, -z + c], [x, z - c], [x - c, z], [-x + c, z], [-x, z - c], [-x, -z + c]];
};

const FACADES: Record<string, Facade> = { balcony: "balcony", column: "columns", columns: "columns", curtain: "curtain", fins: "fins", retail: "balcony" };

export function designFor(key: string): Design {
  const v = parseVariant(key);
  const hash = [...key].reduce((a, c) => a + c.charCodeAt(0), 0);
  if (v.type === "office") return { facade: v.style === "fins" ? "fins" : "curtain", crown: "frame", setback: v.storeys > 15, podium: "plain", lod: true };
  return {
    facade: FACADES[v.style ?? ""] ?? "balcony",
    crown: hash % 2 ? "frame" : "plant",
    setback: v.storeys >= 20 && hash % 3 === 0,
    podium: v.style === "retail" ? "retail" : v.storeys >= 12 ? "plain" : undefined,
    lod: true,
  };
}

function partsOf(key: string, colors: ThemeColors, night: boolean): TowerParts {
  const v = parseVariant(key);
  const { w, d } = variantSize(key);
  switch (v.type) {
    case "tower":
    case "office": {
      const b = { id: key, floors: v.storeys } as Building;
      return towerParts(b, chamfered(w, d, Math.min(4, d * 0.18)), 0, v.storeys, true, designFor(key));
    }
    case "shoplot":
      return shoplotParts(v.n ?? ROW.shoplot!.n, v.storeys, w / (v.n ?? ROW.shoplot!.n), d);
    case "mall":
      return mallParts(v.storeys, w, d);
    default:
      return landedParts({ type: v.type, storeys: v.storeys, style: v.style, n: v.n ?? ROW[v.type]?.n, w, d }, colors, night);
  }
}

const cache = new Map<string, Promise<string>>();

/** The glb (blob URL) for one variant key, in the theme's colours; day or night. Cached per key, mode and palette. */
export function variantGlb(key: string, colors: ThemeColors, night: boolean): Promise<string> {
  const id = `${key}|${night ? "n" : "d"}|${colors.primary}|${colors["chart-3"]}|${colors.background}`;
  let p = cache.get(id);
  if (!p) {
    p = variantBlob(key, colors, night).then((g) => URL.createObjectURL(g.blob));
    cache.set(id, p);
    p.catch(() => cache.delete(id));
  }
  return p;
}

/** The glb itself (exported for size checks). */
export async function variantBlob(key: string, colors: ThemeColors, night: boolean): Promise<{ blob: Blob; bytes: number; vertices: number }> {
  const parts = partsOf(key, colors, night);
  // Landed homes and the clubhouse have their own plain materials (no tower window texture); the rest use the tower set.
  const landed = LANDED.includes(parseVariant(key).type);
  const mats: Partial<Record<Role, THREE.Material>> = landed
    ? landedMaterials(colors, night)
    : towerMaterials({ id: key, floors: 1 } as Building, colors, night, false, night, designFor(key), 0.25); // 128 x 256 texture: panes are a few pixels at map distance
  const scene = new THREE.Scene();
  let vertices = 0;
  for (const r of ROLES) {
    const g = parts[r];
    if (!g) continue;
    vertices += g.getAttribute("position").count;
    scene.add(new THREE.Mesh(g, mats[r]));
  }
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  return { blob: new Blob([glb], { type: "model/gltf-binary" }), bytes: glb.byteLength, vertices };
}

