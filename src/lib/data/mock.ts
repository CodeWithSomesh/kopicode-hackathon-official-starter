import type { Item, ItemStatus } from "@/lib/supabase/database.types";

/** Deterministic sample data used in demo mode (no Supabase configured). */
const titles = [
  "Kickoff checklist",
  "Interview notes",
  "Landing copy draft",
  "Data import",
  "Pricing experiment",
  "Onboarding flow",
  "Weekly report",
  "Partner follow-up",
  "Bug bash",
  "Demo script",
  "Feedback round",
  "Launch prep",
];
const statuses: ItemStatus[] = ["todo", "in_progress", "done"];
// items created per day over two weeks, so the chart has a shape
const perDay = [1, 2, 1, 3, 2, 4, 3, 2, 5, 3, 4, 6, 4, 5];

export const mockItems: Item[] = perDay
  .flatMap((count, day) =>
    Array.from({ length: count }, (_, k) => ({ day, k })),
  )
  .map(({ day, k }, i) => {
    const created = new Date(Date.UTC(2026, 10, 1 + day, 1 + k * 2)).toISOString();
    return {
      id: `demo-${i + 1}`,
      user_id: "00000000-0000-0000-0000-000000000000",
      title: `${titles[i % titles.length]}${i >= titles.length ? ` #${Math.floor(i / titles.length) + 1}` : ""}`,
      description: "Sample record. Connect Supabase to store real data.",
      status: statuses[(i * 7) % 3]!,
      amount: 80 + ((i * 137) % 900),
      created_at: created,
      updated_at: created,
    };
  })
  .reverse();
