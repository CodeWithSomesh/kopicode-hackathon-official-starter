import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PixPanel } from "@/components/homelander/pixel";
import { townshipById, unitById } from "@/lib/homelander/data";

export const metadata: Metadata = { title: "Feng Shui" };

/**
 * Feng Shui (formerly "Tengok Dulu"). Owned by teammate B: read ./CLAUDE.md first.
 * This placeholder only proves the route and the unit lookup work.
 */
export default async function FengShuiPage({ params }: PageProps<"/homes/[id]/feng-shui">) {
  const { id } = await params;
  const unit = unitById[id];
  if (!unit) notFound();

  return (
    <div className="grid gap-4">
      <h1 className="font-pixel text-3xl font-bold">Feng Shui: {unit.name}</h1>
      <PixPanel className="grid gap-2 p-5">
        <p>
          {townshipById[unit.townshipId]?.name} · {unit.type} · {unit.beds} bedrooms · {unit.builtUpSqft.toLocaleString("en-MY")} sq ft
        </p>
        <p className="text-sm text-ink-soft">Coming soon: sun check, furniture fit and Raya / CNY modes for this home.</p>
      </PixPanel>
    </div>
  );
}
