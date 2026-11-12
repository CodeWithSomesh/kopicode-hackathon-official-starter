import type { Metadata } from "next";
import { BankView } from "./bank-view";

export const metadata: Metadata = { title: "Bank" };

export default function HomeLanderBankPage() {
  return <BankView />;
}
