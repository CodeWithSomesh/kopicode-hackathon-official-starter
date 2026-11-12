import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue.</p>
      </div>
      {typeof error === "string" ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : null}
      <AuthForm mode="login" next={typeof next === "string" ? next : undefined} />
    </div>
  );
}
