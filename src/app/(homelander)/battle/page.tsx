import type { Metadata } from "next";
import { getT } from "@/lib/homelander/i18n/server";
import { BattleView } from "./battle-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Battle") };
}

export default function HomeLanderComparePage() {
  return <BattleView />;
}
