import type { Metadata } from "next";
import { getT } from "@/lib/homelander/i18n/server";
import { AuthForm } from "../auth-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Sign in") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const t = await getT();
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("Welcome back")}</h1>
        <p className="text-sm text-muted-foreground">{t("Sign in to continue.")}</p>
      </div>
      {typeof error === "string" ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : null}
      <AuthForm mode="login" next={typeof next === "string" ? next : undefined} />
    </div>
  );
}
