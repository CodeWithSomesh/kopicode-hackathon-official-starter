import type { Metadata } from "next";
import { BattleView } from "./battle-view";

export const metadata: Metadata = { title: "Battle" };

export default function HomeLanderComparePage() {
  return <BattleView />;
}
