import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { centroid } from "@/lib/first-key/geo";
import type { Building } from "@/lib/first-key/types";
import { glassMaterials, outlineGeom } from "../burst/dollhouse";
import type { ThemeColors } from "../use-theme-colors";

/**
 * One of our illustrative towers as a .glb (data: URL) for Google's Model3DElement: the burst's own procedural shell
 * (the chamfered footprint extruded, the glass window texture, the roof slab), so the map tower and the burst's first
 * frame are the same object. Google supports core glTF PBR only (no extensions): the glass becomes a plain
 * MeshStandardMaterial with the same texture. Origin at the footprint's centroid, ground level; metres; exported +Z up, +Y north (Google's frame).
 */
export async function towerGlb(b: Building, colors: ThemeColors, tint?: string): Promise<string> {
  const c = centroid(b.footprint);
  const kx = 111_320 * Math.cos((c[1] * Math.PI) / 180);
  const kz = 110_574;
  // Same outline as the burst's footprintOf: x east, z south.
  const outline = b.footprint.slice(0, -1).map((p) => [(p[0] - c[0]) * kx, -(p[1] - c[1]) * kz] as [number, number]);
  const m = glassMaterials(colors, false);
  const plain = (src: THREE.MeshPhysicalMaterial) =>
    new THREE.MeshStandardMaterial({ color: src.color, map: src.map, roughness: src.roughness, metalness: src.metalness });
  // tint: the picked block in one flat colour (as the other maps draw it), which is the colour the burst starts from.
  // Google's lighting left it near-black (median 42,16,6 vs the burst's 156,87,19): a core-glTF emissive (the tint 20% to white) lifts it.
  const side = tint ? new THREE.MeshStandardMaterial({ color: tint, roughness: 0.6, emissive: new THREE.Color(tint).lerp(new THREE.Color("white"), 0.2) }) : plain(m.solid[1] as THREE.MeshPhysicalMaterial);
  const roof = tint ? side : plain(m.solid[0] as THREE.MeshPhysicalMaterial);
  const tower = new THREE.Group();
  tower.add(new THREE.Mesh(outlineGeom(outline, 0, b.heightM, 0.9), [roof, side]));
  const slab = new THREE.Mesh(outlineGeom(outline, 0, 0.55, 0.18, 0.3), roof);
  slab.position.y = b.heightM;
  tower.add(slab);
  // Google lays a glTF's +Y along the ground (measured: the towers lay on their sides). It reads the model as
  // x east, y north, z up, so turn ours (+Y up, -Z north) a quarter turn about X: y -> z, -z -> y.
  tower.rotation.x = Math.PI / 2;
  const scene = new THREE.Scene();
  scene.add(tower);
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  // A data: URL, not a blob: URL: Model3DElement silently draws nothing from a blob: URL (measured: 0 px changed with
  // blob: and blob:#.glb, 28k px with data:), presumably its ".glb only" source check.
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(new Blob([glb], { type: "model/gltf-binary" }));
  });
}
