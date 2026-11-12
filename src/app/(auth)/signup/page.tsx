import type { Metadata } from "next";
import { AuthCard } from "../auth-card";
import { safeNext } from "../next-path";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next, error } = await searchParams;
  return <AuthCard mode="signup" next={safeNext(next)} error={error} />;
}
