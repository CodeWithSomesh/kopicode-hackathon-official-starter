import type { Metadata } from "next";
import { FindClient } from "@/app/find/find-client";

export const metadata: Metadata = { title: { absolute: "HomeLander: every Gamuda Land home on one map" } };

/**
 * Landing page: full-bleed 3D map of Gamuda Land homes, then one continuous shot into an opened building.
 * The map + hand-over live in src/app/find/find-client.tsx (First Key engine); the overlays in ./_landing/.
 * Owned by teammate A: read ./_landing/CLAUDE.md.
 */
export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const { building, unit, dev } = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return <FindClient initialBuilding={one(building)} initialUnit={one(unit)} initialDev={one(dev)} />;
}
