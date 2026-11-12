import type { Metadata } from "next";
import { InboxIcon, PlusIcon } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listItems } from "@/lib/data/items";
import type { ItemStatus } from "@/lib/supabase/database.types";
import { ItemDialog } from "./item-dialog";
import { ItemsFilters } from "./items-filters";
import { ItemsTable } from "./items-table";

export const metadata: Metadata = { title: "Items" };

const STATUSES = ["todo", "in_progress", "done"] as const;

/**
 * Example full-stack feature: list + search + filter + create/edit/delete.
 * Copy this folder to start a new feature page.
 */
export default async function ItemsPage({ searchParams }: PageProps<"/dashboard/items">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = STATUSES.includes(sp.status as ItemStatus) ? (sp.status as ItemStatus) : undefined;
  const items = await listItems({ q, status });

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Items"
        description="An example resource wired end to end: Supabase table, RLS, Server Actions."
        actions={
          <ItemDialog
            trigger={
              <Button size="sm">
                <PlusIcon /> New item
              </Button>
            }
          />
        }
      />

      <ItemsFilters q={q} status={status} />

      {items.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title={q || status ? "No matches" : "No items yet"}
          description={q || status ? "Try a different search or filter." : "Create your first item to see it here."}
        />
      ) : (
        <Card className="py-0">
          <ItemsTable items={items} />
        </Card>
      )}
    </div>
  );
}
