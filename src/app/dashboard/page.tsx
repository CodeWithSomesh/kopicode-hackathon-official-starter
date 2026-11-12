import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getItemStats, listItems } from "@/lib/data/items";
import { formatDate } from "@/lib/utils";
import { ActivityChart } from "./activity-chart";
import { StatusBadge } from "./items/status-badge";

export const metadata: Metadata = { title: "Overview" };

const currency = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", maximumFractionDigits: 0 });

export default async function OverviewPage() {
  const [user, stats, items] = await Promise.all([getCurrentUser(), getItemStats(), listItems()]);
  const completion = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  const kpis = [
    { label: "Total items", value: stats.total.toString(), hint: "All records you own" },
    { label: "In progress", value: stats.inProgress.toString(), hint: "Being worked on now" },
    { label: "Completion", value: `${completion}%`, hint: `${stats.done} done` },
    { label: "Total value", value: currency.format(stats.totalAmount), hint: "Sum of item amounts" },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Hi, ${user.name.split(" ")[0]}`}
        description="Here's what's happening. Replace these cards with your product's key numbers."
        actions={
          <Button asChild size="sm">
            <Link href="/dashboard/items">Manage items</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="gap-2 py-5">
            <CardHeader className="px-5">
              <CardDescription>{k.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums tracking-tight">{k.value}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 text-xs text-muted-foreground">{k.hint}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Items created per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityChart data={stats.byDay} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent</CardTitle>
            <CardDescription>Latest five items</CardDescription>
            <CardAction>
              <Button asChild variant="ghost" size="icon-sm" aria-label="View all items">
                <Link href="/dashboard/items">
                  <ArrowUpRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet. Create your first item.</p>
            ) : (
              <ul className="grid gap-3">
                {items.slice(0, 5).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        <Badge variant="outline" className="mr-2">Tip</Badge>
        Each team member owns one page under <code className="font-mono">src/app/dashboard/</code>. Add it to the sidebar in{" "}
        <code className="font-mono">src/components/app/nav.ts</code>.
      </p>
    </div>
  );
}
