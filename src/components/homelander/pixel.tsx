import { Slot } from "radix-ui";
import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * HomeLander's 8-bit primitives. Colours come from the game palette in globals.css
 * (ink, sky, pandan, raya, kaya, lilac, teh). Outlines are notched pixel frames
 * (`pix-frame` / `pix-btn`), so leave ~4px of room around each one.
 */

const fills = {
  white: { fill: "var(--j-surface, #ffffff)", text: "text-ink" },
  pandan: { fill: "var(--color-pandan)", text: "text-ink" },
  raya: { fill: "var(--color-raya)", text: "text-white" },
  kaya: { fill: "var(--color-kaya)", text: "text-ink" },
  lilac: { fill: "var(--color-lilac)", text: "text-ink" },
  ink: { fill: "var(--color-ink)", text: "text-white" },
  sky: { fill: "var(--color-cloud)", text: "text-ink" },
} as const;

export type PixTone = keyof typeof fills;

const fillStyle = (tone: PixTone, style?: CSSProperties) =>
  ({
    "--pix-fill": fills[tone].fill,
    ...(tone === "ink" ? { "--pix-line": "var(--color-ink)" } : {}),
    ...style,
  }) as CSSProperties;

type ButtonProps = ComponentProps<"button"> & {
  tone?: PixTone;
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
};

export function PixButton({
  tone = "white",
  size = "md",
  asChild,
  className,
  style,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(
        "pix-btn inline-flex items-center justify-center gap-2 leading-none",
        fills[tone].text,
        size === "sm" && "min-h-9 px-3 text-sm",
        size === "md" && "min-h-11 px-4 text-base",
        size === "lg" && "min-h-14 px-6 text-lg",
        className,
      )}
      style={fillStyle(tone, style)}
      {...props}
    />
  );
}

type PanelProps = ComponentProps<"div"> & {
  tone?: PixTone;
  flat?: boolean;
  asChild?: boolean;
};

export function PixPanel({
  tone = "white",
  flat,
  asChild,
  className,
  style,
  ...props
}: PanelProps) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      className={cn(
        "pix-frame",
        flat && "pix-flat",
        fills[tone].text,
        className,
      )}
      style={fillStyle(tone, style)}
      {...props}
    />
  );
}

/** Segmented meter, 10 blocks, like an HP bar. `value` is 0-100. */
export function PixMeter({
  value,
  tone = "pandan",
  label,
  className,
}: {
  value: number;
  tone?: "pandan" | "raya" | "kaya" | "lilac" | "sky";
  label: string;
  className?: string;
}) {
  const on = Math.round(Math.max(0, Math.min(100, value)) / 10);
  const color = {
    pandan: "bg-pandan",
    raya: "bg-raya",
    kaya: "bg-kaya",
    lilac: "bg-lilac-deep",
    sky: "bg-sky-deep",
  }[tone];
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("flex gap-[3px] bg-ink p-[3px]", className)}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={cn("h-3 flex-1", i < on ? color : "bg-ink-soft/50")}
        />
      ))}
    </div>
  );
}

/** Small pixel label, e.g. "3 LEFT". Uses the pixel label face, so keep it to a few words. */
export function PixTag({
  tone = "white",
  className,
  ...props
}: ComponentProps<"span"> & {
  tone?: "white" | "pandan" | "raya" | "kaya" | "lilac" | "ink";
}) {
  const tones = {
    white: "bg-white text-ink",
    pandan: "bg-pandan text-ink",
    raya: "bg-raya text-white",
    kaya: "bg-kaya text-ink",
    lilac: "bg-lilac text-ink",
    ink: "bg-ink text-white",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border-2 border-ink px-1.5 py-0.5 font-pixel-label text-[11px] leading-none uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
