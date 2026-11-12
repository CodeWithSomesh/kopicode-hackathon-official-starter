"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/homelander/i18n/client";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? signIn : signUp,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {mode === "signup" && (
        <div className="grid gap-2">
          <Label htmlFor="fullName">{t("Name")}</Label>
          <Input id="fullName" name="fullName" autoComplete="name" placeholder="Aisyah Rahman" />
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="email">{t("Email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">{t("Password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        {mode === "login" ? t("Sign in") : t("Create account")}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>{t("No account?")} <Link href="/signup" className="text-foreground underline underline-offset-4">{t("Sign up")}</Link></>
        ) : (
          <>{t("Have an account?")} <Link href="/login" className="text-foreground underline underline-offset-4">{t("Sign in")}</Link></>
        )}
      </p>
    </form>
  );
}
