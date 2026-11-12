import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { centroid } from "@/lib/first-key/geo";
import type { Building } from "@/lib/first-key/types";
import { ROLES, towerMaterials, towerParts } from "../tower/tower-model";
import type { ThemeColors } from "../use-theme-colors";

/** The burst's footprint in metres around the centroid: x east, z south. */
export function outlineOf(b: Building): [number, number][] {
  const c = centroid(b.footprint);
  const kx = 111_320 * Math.cos((c[1] * Math.PI) / 180);
  return b.footprint.slice(0, -1).map((p) => [(p[0] - c[0]) * kx, -(p[1] - c[1]) * 110_574] as [number, number]);
}

/**
 * One tower as a .glb for Mapbox's model layer (placed on a point at the footprint's centroid): the burst's own
 * geometry with core-glTF materials. Returns the blob URL and its size in bytes.
 */
export async function towerGlb(b: Building, colors: ThemeColors, dark: boolean): Promise<{ url: string; bytes: number }> {
  const parts = towerParts(b, outlineOf(b), 0, b.floors, true);
  const mats = towerMaterials(b, colors, dark, false);
  const scene = new THREE.Scene();
  for (const r of ROLES) if (parts[r]) scene.add(new THREE.Mesh(parts[r], mats[r]));
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  return { url: URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })), bytes: glb.byteLength };
}
