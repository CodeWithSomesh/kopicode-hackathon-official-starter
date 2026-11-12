import type { Metadata } from "next";
import Link from "next/link";
import { PixPanel, PixTag } from "@/components/homelander/pixel";
import { UnitPhoto } from "@/components/homelander/unit-photo";
import { rm, townshipById, units } from "@/lib/homelander/data";
import { planFor } from "../homes/[id]/feng-shui/plans";

export const metadata: Metadata = { title: "Feng Shui Builder" };

/** The Feng Shui tab: pick a home, then open its builder at /homes/<id>/feng-shui. */
export default function FengShuiPickerPage() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-pixel text-3xl font-bold">Feng Shui Builder</h1>
          <PixTag tone="kaya">For fun, not professional advice</PixTag>
        </div>
        <p className="text-ink-soft">
          Pick a home to see where the sun lands, how the furniture fits and what the feng shui says.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {units.map((u) => (
          <li key={u.id}>
            <PixPanel asChild className="group grid h-full gap-3 p-3 transition-transform hover:-translate-y-0.5">
              <Link href={`/homes/${u.id}/feng-shui`}>
                <div className="relative aspect-[16/9] overflow-hidden bg-cloud">
                  <UnitPhoto
                    photo={u.photo}
                    alt={u.photoAlt}
                    fill
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="grid gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-pixel text-lg leading-tight font-bold">{u.name}</h2>
                    <span className="font-pixel text-sm whitespace-nowrap">{rm(u.priceRM)}</span>
                  </div>
                  <p className="text-sm text-ink-soft">
                    {townshipById[u.townshipId]?.name} · {u.beds} bed · {u.builtUpSqft.toLocaleString("en-MY")} sq ft
                  </p>
                  <div>
                    <PixTag tone="lilac">{planFor(u.type).label}</PixTag>
                  </div>
                </div>
              </Link>
            </PixPanel>
          </li>
        ))}
      </ul>
    </div>
  );
}
