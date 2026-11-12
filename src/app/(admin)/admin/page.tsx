import type { Metadata } from "next";
import { DashboardLoader } from "./_components/dashboard-loader";

export const metadata: Metadata = { title: { absolute: "Buyer insights · HomeLander admin" } };

export default function AdminPage() {
  return <DashboardLoader />;
}
