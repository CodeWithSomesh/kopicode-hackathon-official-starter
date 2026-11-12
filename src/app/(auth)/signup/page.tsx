import type { Metadata } from "next";
import { getT } from "@/lib/homelander/i18n/server";
import { AuthCard } from "../auth-card";
import { safeNext } from "../next-path";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Sign up") };
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next, error } = await searchParams;
  return <AuthCard mode="signup" next={safeNext(next)} error={error} />;
}
