import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isDemo: boolean;
};

const DEMO_USER: CurrentUser = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "demo@kopicode.dev",
  name: "Demo User",
  avatarUrl: null,
  isDemo: true,
};

/**
 * Data Access Layer entry point. Returns the signed-in user or redirects to
 * /login. Wrapped in React `cache` so it runs once per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  if (isDemoMode) return DEMO_USER;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");

  const user = data.user;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    name:
      profile?.full_name ??
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split("@")[0] ??
      "You",
    avatarUrl: profile?.avatar_url ?? null,
    isDemo: false,
  };
});
