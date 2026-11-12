import type { Metadata, Viewport } from "next";
import { HomeLanderThemeRoot } from "@/components/homelander/theme-root";
import { HomeLanderShell } from "./shell";

export const metadata: Metadata = {
  title: { default: "HomeLander", template: "%s · HomeLander" },
  description: "Swipe Gamuda Land homes, battle your favourites, check what the bank will lend and ask Uncle.",
};

export const viewport: Viewport = { themeColor: "#f5f6f8" };

/** Buyer-facing app: web layout on desktop, app layout on phones. No sidebar, no auth, sample data only. */
export default function HomeLanderLayout({ children }: { children: React.ReactNode }) {
  return (
    <HomeLanderThemeRoot className="min-h-svh">
      <HomeLanderShell>{children}</HomeLanderShell>
    </HomeLanderThemeRoot>
  );
}
