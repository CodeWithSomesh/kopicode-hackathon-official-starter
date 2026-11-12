"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env, isDemoMode } from "@/lib/env";
import { getT } from "@/lib/homelander/i18n/server";
import type { TFn } from "@/lib/homelander/i18n/translate";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string } | null;

// A function, not a module constant: the messages follow the EN | Manglish cookie of each request.
const credentials = (t: TFn) =>
  z.object({
    email: z.email(t("Enter a valid email")),
    password: z.string().min(6, t("Password must be at least 6 characters")),
  });

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (isDemoMode) redirect("/dashboard");
  const parsed = credentials(await getT()).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (isDemoMode) redirect("/dashboard");
  const parsed = credentials(await getT()).extend({ fullName: z.string().trim().max(100).optional() }).safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${env.siteUrl}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  // Email confirmation off in Supabase -> session exists, go straight in.
  if (data.session) redirect("/dashboard");
  const t = await getT();
  return { message: t("Check your email to confirm your account, then sign in.") };
}
