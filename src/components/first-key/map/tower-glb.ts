import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { centroid } from "@/lib/first-key/geo";
import type { Building } from "@/lib/first-key/types";
import { glassMaterials, outlineGeom } from "../burst/dollhouse";
import type { ThemeColors } from "../use-theme-colors";

/**
 * One of our illustrative towers as a .glb (blob: URL) for Google's Model3DElement: the burst's own procedural shell
 * (the chamfered footprint extruded, the glass window texture, the roof slab), so the map tower and the burst's first
 * frame are the same object. Google supports core glTF PBR only (no extensions): the glass becomes a plain
 * MeshStandardMaterial with the same texture. Origin at the footprint's centroid, ground level; metres; +Y up, -Z north.
 */
export async function towerGlb(b: Building, colors: ThemeColors): Promise<string> {
  const c = centroid(b.footprint);
  const kx = 111_320 * Math.cos((c[1] * Math.PI) / 180);
  const kz = 110_574;
  // Same outline as the burst's footprintOf: x east, z south.
  const outline = b.footprint.slice(0, -1).map((p) => [(p[0] - c[0]) * kx, -(p[1] - c[1]) * kz] as [number, number]);
  const m = glassMaterials(colors, false);
  const plain = (src: THREE.MeshPhysicalMaterial) =>
    new THREE.MeshStandardMaterial({ color: src.color, map: src.map, roughness: src.roughness, metalness: src.metalness });
  const side = plain(m.solid[1] as THREE.MeshPhysicalMaterial);
  const roof = plain(m.solid[0] as THREE.MeshPhysicalMaterial);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(outlineGeom(outline, 0, b.heightM, 0.9), [roof, side]));
  const slab = new THREE.Mesh(outlineGeom(outline, 0, 0.55, 0.18, 0.3), roof);
  slab.position.y = b.heightM;
  scene.add(slab);
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  return URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" }));
}
