import type { Metadata } from "next";
import { getT } from "@/lib/homelander/i18n/server";
import { AuthCard } from "../auth-card";
import { safeNext } from "../next-path";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Log in") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return <AuthCard mode="login" next={safeNext(next)} error={error} />;
}
