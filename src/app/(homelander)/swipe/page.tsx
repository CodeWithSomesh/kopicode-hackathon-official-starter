import type { Metadata } from "next";
import { SwipeDeck } from "./swipe-deck";

export const metadata: Metadata = { title: "Swipe homes" };

export default function HomeLanderSwipePage() {
  return <SwipeDeck />;
}
