import type { Metadata } from "next";
import { RegretTest } from "./regret-test";

export const metadata: Metadata = {
  title: "Ask Uncle",
  description: "The Regret Test: Uncle asks five questions out loud and tells you which Gamuda Land home you won't regret.",
};

export default function UnclePage() {
  return <RegretTest />;
}
