import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PixTag } from "@/components/homelander/pixel";
import { townshipById, unitById } from "@/lib/homelander/data";
import { getT } from "@/lib/homelander/i18n/server";
import { FengShuiBuilder } from "./builder";
import { planFor, planNoun } from "./plans";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Feng Shui Builder") };
}

/** Feng Shui Builder (first pitched as "Tengok Dulu"). Owned by teammate B: read ./CLAUDE.md first. */
export default async function FengShuiPage({
  params,
}: PageProps<"/homes/[id]/feng-shui">) {
  const { id } = await params;
  const t = await getT();
  const unit = unitById[id];
  if (!unit) notFound();
  const township = townshipById[unit.townshipId];
  const plan = planFor(unit.type);

  return (
    <div className="grid grid-cols-1 gap-4">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-pixel text-3xl font-bold">{t("Feng Shui Builder")}</h1>
          <PixTag tone="kaya">{t("For fun, not professional advice")}</PixTag>
          <Link
            href="/feng-shui"
            className="ml-auto text-sm font-semibold underline decoration-2 underline-offset-4"
          >
            {t("Change home")}
          </Link>
        </div>
        <p className="text-ink-soft">
          <span className="font-semibold text-ink">{unit.name}</span> ·{" "}
          {township?.name} · {unit.type} · {t("{n} bedrooms", { n: unit.beds })} ·{" "}
          {unit.builtUpSqft.toLocaleString("en-MY")} sq ft
        </p>
        <p className="text-sm text-ink-soft">
          {t("Sample {plan} plan, not this unit's actual layout.", { plan: t(planNoun(plan)) })}
        </p>
      </header>
      <FengShuiBuilder
        unitId={unit.id}
        planId={plan.id}
        lat={township?.pos.lat ?? 3.14}
        lng={township?.pos.lng ?? 101.69}
      />
    </div>
  );
}
