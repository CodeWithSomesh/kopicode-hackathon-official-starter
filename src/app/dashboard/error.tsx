"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid justify-items-start gap-3 rounded-xl border p-6">
      <h2 className="font-semibold">Something broke on this page</h2>
      <p className="text-sm text-muted-foreground">{error.message || "Unknown error"}</p>
      <Button size="sm" variant="outline" onClick={reset}>Try again</Button>
    </div>
  );
}
