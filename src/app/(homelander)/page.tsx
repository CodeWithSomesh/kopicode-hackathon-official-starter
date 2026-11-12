import type { Metadata } from "next";
import { MapView } from "./_landing/map-view";

export const metadata: Metadata = { title: { absolute: "HomeLander: every Gamuda Land home on one map" } };

/** Landing page: full-bleed 3D map of Gamuda Land homes. Owned by teammate A: read ./_landing/CLAUDE.md. */
export default function LandingPage() {
  return <MapView />;
}
