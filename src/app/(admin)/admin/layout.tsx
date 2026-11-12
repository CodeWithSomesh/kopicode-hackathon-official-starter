import type { Metadata } from "next";
import { AdminShell } from "./_components/shell";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Buyer insights", template: "%s · HomeLander admin" },
  description: "Gamuda Land's view of HomeLander: demand, pricing gaps, pass reasons and pre-qualified leads.",
};

/** Gamuda's side of HomeLander: a plain analytics shell, separate from the buyer app's Kopitiam theme. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-root min-h-svh bg-background font-sans text-foreground">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
