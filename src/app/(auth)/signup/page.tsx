import type { Metadata } from "next";
import { getT } from "@/lib/homelander/i18n/server";
import { AuthForm } from "../auth-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Create account") };
}

export default async function SignupPage() {
  const t = await getT();
  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("Create your account")}</h1>
        <p className="text-sm text-muted-foreground">{t("It takes ten seconds.")}</p>
      </div>
      <AuthForm mode="signup" />
    </div>
  );
}
