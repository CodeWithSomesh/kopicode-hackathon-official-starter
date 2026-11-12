"use client";

import { LightbulbIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- section card */

export function Section({
  id,
  title,
  purpose,
  audience,
  takeaway,
  actions,
  children,
  className,
}: {
  id: string;
  title: string;
  /** One line: what this tells you. */
  purpose: string;
  /** Who uses it. */
  audience: string;
  takeaway?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-20", className)}>
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div className="grid min-w-0 gap-1">
            <h2 id={`${id}-title`} className="text-base leading-tight font-semibold">
              {t(title)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(purpose)} <span className="text-foreground/70">{t("For {audience}.", { audience: t(audience) })}</span>
            </p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {takeaway ? <Takeaway>{takeaway}</Takeaway> : null}
        <div className="px-5 pt-1 pb-5">{children}</div>
      </Card>
    </section>
  );
}

export function Takeaway({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="mx-5 mb-3 flex items-start gap-2.5 rounded-lg border border-[color-mix(in_oklch,var(--chart-1)_30%,transparent)] bg-[color-mix(in_oklch,var(--chart-1)_7%,transparent)] px-3.5 py-2.5 text-sm">
      <LightbulbIcon className="mt-0.5 size-4 shrink-0 text-[var(--chart-1)]" aria-hidden />
      <p>
        <span className="sr-only">{t("Takeaway:")} </span>
        {children}
      </p>
    </div>
  );
}

/** A bordered inner panel, like the reference's nested chart wells. */
export function Panel({ title, note, children, className }: { title?: string; note?: string; children: React.ReactNode; className?: string }) {
  const t = useT();
  return (
    <div className={cn("rounded-lg border bg-background/40 p-4", className)}>
      {title ? (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">{t(title)}</h3>
          {note ? <p className="text-xs text-muted-foreground">{t(note)}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------- deltas */

export function Delta({ value, kind, invert = false }: { value: number | null; kind: "count" | "rate" | "money"; invert?: boolean }) {
  const t = useT();
  if (value === null || !Number.isFinite(value)) return <Badge variant="secondary">{t("new")}</Badge>;
  const up = value >= 0;
  const good = invert ? !up : up;
  const text = kind === "rate" ? `${up ? "+" : ""}${(value * 100).toFixed(1)} pts` : `${up ? "+" : ""}${(value * 100).toFixed(1)}%`;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        good ? "bg-[color-mix(in_oklch,var(--good)_14%,transparent)] text-[var(--good)]" : "bg-[color-mix(in_oklch,var(--bad)_14%,transparent)] text-[var(--bad)]",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {text}
      <span className="sr-only"> {t("vs previous period")}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- sparkline (plain SVG: cheap enough for table rows) */

export function Sparkline({ data, className, color = "var(--chart-1)", label }: { data: number[]; className?: string; color?: string; label?: string }) {
  const w = 100;
  const h = 28;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => [i * step, h - 2 - (v / max) * (h - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-7 w-full overflow-visible", className)} role="img" aria-label={label ?? `Trend: ${data.join(", ")}`}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------------------------------------------------------- recharts styling */

export const axis = {
  tickLine: false,
  axisLine: false,
  fontSize: 12,
  stroke: "var(--muted-foreground)",
  tick: { fill: "var(--muted-foreground)" },
} as const;

export const tooltip = {
  cursor: { fill: "var(--muted)", opacity: 0.6, stroke: "var(--border)" },
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--popover-foreground)",
    boxShadow: "0 4px 16px rgb(0 0 0 / 0.08)",
  },
  labelStyle: { color: "var(--popover-foreground)", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "var(--popover-foreground)", padding: 0 },
} as const;

export const legend = { iconType: "circle" as const, iconSize: 8, wrapperStyle: { fontSize: 12, color: "var(--muted-foreground)" } };

/**
 * A chart with an accessible name and a screen-reader table of the numbers it draws.
 * Charts are SVG; the hidden table is the fallback for assistive tech.
 */
export function ChartFigure({
  label,
  columns,
  rows,
  className,
  children,
}: {
  label: string;
  columns: string[];
  rows: (string | number)[][];
  className?: string;
  children: React.ReactNode;
}) {
  const t = useT();
  label = t(label);
  columns = columns.map((c) => t(c));
  return (
    <figure className={cn("relative", className)} aria-label={label}>
      <div aria-hidden className="h-full w-full">
        {children}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** A labelled horizontal meter for ranked lists (accessible as text). */
export function Meter({ value, max = 1, color = "var(--chart-1)", className }: { value: number; max?: number; color?: string; className?: string }) {
  return (
    <span className={cn("block h-2 w-full overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value / (max || 1))) * 100}%`, background: color }} />
    </span>
  );
}

export function Empty({ children }: { children?: React.ReactNode }) {
  const t = useT();
  return <div className="grid h-40 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">{children ?? t("No data for this filter yet.")}</div>;
}

export function LiveBadge() {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_oklch,var(--live)_15%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--live)]">
      <span className="size-1.5 rounded-full bg-[var(--live)]" aria-hidden />
      {t("Live")}
    </span>
  );
}
