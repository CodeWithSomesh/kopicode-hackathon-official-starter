import type { Metadata } from "next";
import { AuthCard } from "../auth-card";
import { safeNext } from "../next-path";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return <AuthCard mode="login" next={safeNext(next)} error={error} />;
}
