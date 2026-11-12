import type { Availability } from "@/lib/homelander/data";
import { useT } from "@/lib/homelander/i18n/client";
import type { TFn } from "@/lib/homelander/i18n/translate";
import { cn } from "@/lib/utils";

export const statusTone = {
  Available: "pandan",
  "Few left": "kaya",
  "Last unit": "raya",
  "Sold out": "ink",
} as const satisfies Record<Availability["status"], string>;

export const stockLabel = (a: Availability, t: TFn) =>
  a.status === "Sold out" ? t("Sold out") : a.left === 1 ? t("Last unit") : t("{n} left", { n: a.left });

const SEGMENTS = 12;

/** Units left as a segmented stock bar, like an item counter in a shop. */
export function StockBar({ a, className }: { a: Availability; className?: string }) {
  const t = useT();
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
      aria-label={t("Units left")}
      aria-valuenow={a.left}
      aria-valuemin={0}
      aria-valuemax={a.total}
      aria-valuetext={t("{left} of {total} units left", { left: a.left, total: a.total })}
      className={cn("flex gap-[3px] bg-ink p-[3px]", className)}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={cn("h-2.5 flex-1", i < on ? fill : "bg-ink-soft/30")} />
      ))}
    </div>
  );
}
