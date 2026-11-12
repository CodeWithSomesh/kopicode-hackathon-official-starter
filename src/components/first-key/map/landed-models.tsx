"use client";

import { useEffect, useState } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { enclave, groups } from "@/lib/first-key/landed";
import type { ThemeColors } from "../use-theme-colors";
import { LROLES, groupSpec, landedMaterials, landedParts, type LandedSpec } from "../tower/landed-model";
import { groupPoints } from "./landed-geo";

/** The enclave's terrace rows, semi-D pairs, bungalows and clubhouse as glTF models on Mapbox's model layer (same builder as the burst). */
const BUILDINGS = [...groups, { ...enclave.clubhouse, id: "club" }];
async function glb(spec: LandedSpec, colors: ThemeColors, dark: boolean): Promise<string> {
  const parts = landedParts(spec, colors, dark);
  const mats = landedMaterials(colors, dark);
  const scene = new THREE.Scene();
  for (const r of LROLES) if (parts[r]) scene.add(new THREE.Mesh(parts[r], mats[r]));
  const buf = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  return URL.createObjectURL(new Blob([buf], { type: "model/gltf-binary" }));
}

export function LandedModels({ loaded, colors, dark, night, onReady }: { loaded: boolean; colors: ThemeColors; dark: boolean; night: number; onReady: (ok: boolean) => void }) {
  const { current: ref } = useMap();
  const variant = dark ? "n" : "d";
  const [ready, setReady] = useState<string>();
  useEffect(() => {
    const map = ref?.getMap();
    if (!map || !loaded) return;
    let dead = false;
    const urls: string[] = [];
    const seen = new Set<string>();
    (async () => {
      for (const b of BUILDINGS) {
        if (seen.has(b.variant)) continue;
        seen.add(b.variant);
        const url = await glb(groupSpec(b), colors, dark);
        urls.push(url);
        if (dead) return;
        map.addModel(`lg-${b.variant}-${variant}`, url);
      }
      if (!dead) {
        setReady(variant);
        onReady(true);
      }
    })().catch((e) => {
      console.warn(e);
      if (!dead) onReady(false);
    });
    return () => {
      dead = true;
      setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 5000);
    };
    // variant is derived from dark
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, dark, loaded]);
  if (ready !== variant) return null;
  const layer = (rot: 0 | 180) =>
    ({
      id: `landed-models-${rot}`,
      type: "model",
      slot: "middle",
      minzoom: 14,
      layout: { "model-id": ["get", "model"] },
      paint: { "model-type": "common-3d", "model-scale": [1, 1, 1], "model-rotation": [0, 0, rot], "model-cast-shadows": true, "model-receive-shadows": true, "model-emissive-strength": night },
    }) as unknown as LayerProps;
  return (
    <>
      {([0, 180] as const).map((rot) => (
        <Source key={rot} id={`landed-points-${rot}`} type="geojson" data={groupPoints((v) => `lg-${v}-${variant}`, rot)}>
          <Layer {...layer(rot)} />
        </Source>
      ))}
    </>
  );
}
