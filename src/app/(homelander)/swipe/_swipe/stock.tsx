import type { Availability } from "@/lib/homelander/data";
import { cn } from "@/lib/utils";

export const statusTone = {
  Available: "pandan",
  "Few left": "kaya",
  "Last unit": "raya",
  "Sold out": "ink",
} as const satisfies Record<Availability["status"], string>;

export const stockLabel = (a: Availability) =>
  a.status === "Sold out" ? "Sold out" : a.left === 1 ? "Last unit" : `${a.left} left`;

const SEGMENTS = 12;

/** Units left as a segmented stock bar, like an item counter in a shop. */
export function StockBar({ a, className }: { a: Availability; className?: string }) {
  const on = a.left === 0 ? 0 : Math.max(1, Math.round((a.left / Math.max(a.total, 1)) * SEGMENTS));
  const fill = {
    Available: "bg-pandan",
    "Few left": "bg-kaya",
    "Last unit": "bg-raya",
    "Sold out": "bg-raya",
  }[a.status];
  return (
    <div
      role="meter"
      aria-label="Units left"
      aria-valuenow={a.left}
      aria-valuemin={0}
      aria-valuemax={a.total}
      aria-valuetext={`${a.left} of ${a.total} units left`}
      className={cn("flex gap-[3px] bg-ink p-[3px]", className)}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={cn("h-2.5 flex-1", i < on ? fill : "bg-ink-soft/30")} />
      ))}
    </div>
  );
}
