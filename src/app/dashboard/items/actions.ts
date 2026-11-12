"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message: string } | null;

const ItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  amount: z.coerce.number().min(0).max(1_000_000_000).default(0),
});

const DEMO_MSG = "Demo mode: connect Supabase to save changes.";

/** Server Actions re-check the user themselves. Never trust the client. */
export async function saveItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await getCurrentUser();
  const parsed = ItemSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    status: formData.get("status") || undefined,
    amount: formData.get("amount") || 0,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (isDemoMode) return { ok: false, message: DEMO_MSG };

  const id = formData.get("id");
  const supabase = await createClient();
  const { error } =
    typeof id === "string" && id
      ? await supabase.from("items").update(parsed.data).eq("id", id)
      : await supabase.from("items").insert(parsed.data);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: id ? "Saved" : "Created" };
}

export async function deleteItem(id: string): Promise<ActionState> {
  await getCurrentUser();
  if (isDemoMode) return { ok: false, message: DEMO_MSG };

  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Deleted" };
}
