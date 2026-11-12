import type { Metadata } from "next";
import { FindClient } from "./find-client";

export const metadata: Metadata = { title: "Find a home" };

// /find?building=<buildingId>&unit=<unitId> opens on that building (and unit); /find?dev=<id> on that development.
export default async function FindPage({ searchParams }: PageProps<"/find">) {
  const { building, unit, dev } = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return <FindClient initialBuilding={one(building)} initialUnit={one(unit)} initialDev={one(dev)} />;
}
