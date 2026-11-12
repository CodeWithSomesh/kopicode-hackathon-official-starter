"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The dashboard runs in the browser only: it merges this browser's live HomeLander session
 * (localStorage) with the seeded sample, and the sample is generated client-side on first load.
 */
export const DashboardLoader = dynamic(() => import("./dashboard").then((m) => m.Dashboard), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-5" aria-busy="true" aria-label="Loading buyer insights">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  ),
});
