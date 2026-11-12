import type { Metadata } from "next";
import { getT } from "@/lib/homelander/i18n/server";
import { BankView } from "./bank-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Bank") };
}

export default function HomeLanderBankPage() {
  return <BankView />;
}
