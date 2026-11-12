import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Item, ItemStatus } from "@/lib/supabase/database.types";
import { mockItems } from "./mock";

/**
 * Example data module. Pattern to copy for each feature:
 *   1. Every exported function resolves the user first (authorization).
 *   2. Supabase RLS is the second line of defence.
 *   3. Demo mode returns mock data so the UI works before Supabase is set up.
 */

export async function listItems(opts: { q?: string; status?: ItemStatus } = {}) {
  await getCurrentUser();
  const q = opts.q?.trim().toLowerCase();

  if (isDemoMode) {
    return mockItems.filter(
      (i) =>
        (!q || i.title.toLowerCase().includes(q)) &&
        (!opts.status || i.status === opts.status),
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("title", `%${q}%`);
  if (opts.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export type ItemStats = {
  total: number;
  done: number;
  inProgress: number;
  totalAmount: number;
  byDay: { date: string; count: number; amount: number }[];
};

export async function getItemStats(): Promise<ItemStats> {
  const items: Item[] = await listItems();
  const byDayMap = new Map<string, { count: number; amount: number }>();

  for (const item of items) {
    const day = item.created_at.slice(0, 10);
    const cur = byDayMap.get(day) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += Number(item.amount);
    byDayMap.set(day, cur);
  }

  return {
    total: items.length,
    done: items.filter((i) => i.status === "done").length,
    inProgress: items.filter((i) => i.status === "in_progress").length,
    totalAmount: items.reduce((s, i) => s + Number(i.amount), 0),
    byDay: [...byDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
  };
}
