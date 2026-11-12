import type { Metadata } from "next";
import { getT } from "@/lib/homelander/i18n/server";
import { SwipeDeck } from "./swipe-deck";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Swipe homes") };
}

export default function HomeLanderSwipePage() {
  return <SwipeDeck />;
}
