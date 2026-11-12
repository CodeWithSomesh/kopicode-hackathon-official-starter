"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { ok: boolean; message: string } | null;

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (isDemoMode) return { ok: false, message: "Demo mode: connect Supabase to save." };

  const parsed = z.string().trim().min(1, "Name is required").max(100).safeParse(formData.get("fullName"));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid name" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data }).eq("id", user.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile updated" };
}
