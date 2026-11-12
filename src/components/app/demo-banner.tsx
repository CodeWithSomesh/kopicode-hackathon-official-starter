import { InfoIcon } from "lucide-react";
import { isDemoMode } from "@/lib/env";

export function DemoBanner() {
  if (!isDemoMode) return null;
  return (
    <div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-800 md:px-6 dark:text-amber-200">
      <InfoIcon className="size-3.5 shrink-0" />
      <span>
        Demo mode: showing sample data. Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to turn on sign-in and saving.
      </span>
    </div>
  );
}
