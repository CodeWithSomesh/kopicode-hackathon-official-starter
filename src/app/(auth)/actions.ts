"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env, isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "./next-path";

export type AuthField = "email" | "password" | "fullName";
export type AuthState = { error?: string; field?: AuthField; message?: string; email?: string; fullName?: string } | null;

const Credentials = z.object({
  email: z.email("That email doesn't look right. Check it has an @ and a domain, like aisyah@gmail.com."),
  password: z.string().min(6, "Your password needs at least 6 characters. Add a few more and try again."),
});

/** Supabase's messages are written for developers; say what happened and what to do next. */
function friendly(message: string): { error: string; field?: AuthField } {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return { error: "That email and password don't match an account. Check both, or sign up if you're new.", field: "password" };
  if (m.includes("email not confirmed"))
    return { error: "Please confirm your email first. Open the link we sent you, then log in.", field: "email" };
  if (m.includes("already registered") || m.includes("already been registered"))
    return { error: "There's already an account with that email. Log in instead.", field: "email" };
  if (m.includes("rate limit") || m.includes("too many"))
    return { error: "Too many tries in a short time. Wait a minute, then try again." };
  if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("least")))
    return { error: "That password is too easy to guess. Try a longer one with a mix of words and numbers.", field: "password" };
  return { error: `We couldn't sign you in: ${message}. Please try again.` };
}

async function origin() {
  const h = await headers();
  return h.get("origin") ?? env.siteUrl;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const next = safeNext(formData.get("next"));
  if (isDemoMode) redirect(next);
  const parsed = Credentials.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message, field: issue?.path[0] as AuthField, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ...friendly(error.message), email };

  redirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const next = safeNext(formData.get("next"));
  if (isDemoMode) redirect(next);
  const parsed = Credentials.extend({ fullName: z.string().trim().max(100, "Keep your name under 100 characters.").optional() }).safeParse(
    Object.fromEntries(formData),
  );
  const email = String(formData.get("email") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message, field: issue?.path[0] as AuthField, email, fullName };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ...friendly(error.message), email, fullName };

  // Email confirmation off in Supabase -> session exists, go straight in.
  if (data.session) redirect(next);
  return { message: "Almost there. We've sent you an email: open the link inside and Mochi will be waiting.", email, fullName };
}
