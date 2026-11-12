"use client";

import type { ComponentProps } from "react";
import { defineSprite } from "@/components/homelander/sprite";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";

/** Gold coin for the bank's loot. */
export const coin = defineSprite(
  [
    "..kkkk..",
    ".kyyyyk.",
    "kywyyydk",
    "kywyyydk",
    "kyyyyydk",
    "kyyyyddk",
    ".kddddk.",
    "..kkkk..",
  ],
  { k: "#2b1d3f", y: "#ffcf3f", d: "#c98f12", w: "#ffffff" },
);

type MoneyFieldProps = Omit<ComponentProps<"input">, "onChange" | "value"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  /** "RM" for money, a word like "years" for other numbers. */
  prefix?: string;
  suffix?: string;
};

/** Large pixel-framed numeric input with an RM prefix, a hint and an error that names the fix. */
export function MoneyField({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  prefix = "RM",
  suffix,
  className,
  ...rest
}: MoneyFieldProps) {
  const t = useT();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-error` : undefined;
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {t(label)}
      </label>
      <div
        className={cn(
          "pix-frame pix-flat flex h-14 items-center gap-2 px-3",
          "focus-within:outline-[3px] focus-within:outline-offset-[6px] focus-within:outline-kaya focus-within:outline-solid",
        )}
        style={error ? ({ "--pix-line": "var(--color-raya)" } as React.CSSProperties) : undefined}
      >
        {prefix ? <span className="font-pixel text-lg text-ink-soft">{prefix}</span> : null}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errId, hintId].filter(Boolean).join(" ") || undefined}
          className="h-full w-0 min-w-0 flex-1 bg-transparent text-xl font-medium text-ink tabular-nums placeholder:text-ink-soft/50 focus-visible:outline-none"
          {...rest}
        />
        {suffix ? <span className="text-sm text-ink-soft">{t(suffix)}</span> : null}
      </div>
      {error ? (
        <p id={errId} className="text-sm font-medium text-raya-deep">
          {t(error)}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-xs text-ink-soft">
          {t(hint)}
        </p>
      ) : null}
    </div>
  );
}

/** Pick-one buttons in a pixel frame (radio group). */
export function Segmented<T extends string>({
  id,
  label,
  hint,
  value,
  options,
  onChange,
  needed,
}: {
  id: string;
  label: string;
  hint?: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Show a "Needed" tag while unanswered. */
  needed?: boolean;
}) {
  const t = useT();
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span id={`${id}-label`} className="text-sm font-medium text-ink">
          {t(label)}
        </span>
        {needed && value === undefined ? (
          <span className="border-2 border-ink bg-kaya px-1.5 py-0.5 font-pixel-label text-[10px] leading-none uppercase">
            {t("Needed")}
          </span>
        ) : null}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="pix-frame pix-flat grid grid-cols-[repeat(auto-fit,minmax(4rem,1fr))] gap-1 p-1"
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn(
                "min-h-10 rounded-[10px] px-1.5 text-[13px] font-medium sm:px-2 sm:text-sm whitespace-nowrap transition-colors",
                "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-kaya focus-visible:outline-solid",
                on ? "bg-ink text-white" : "text-ink hover:bg-cloud",
              )}
            >
              {t(o.label)}
            </button>
          );
        })}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-soft">
          {t(hint)}
        </p>
      ) : null}
    </div>
  );
}

/** Pixel on/off switch. */
export function PixSwitch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id: string;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {t(label)}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="pix-frame pix-flat relative flex h-9 w-20 shrink-0 items-center p-1"
        style={{ "--pix-fill": checked ? "var(--color-pandan)" : "var(--color-cloud)" } as React.CSSProperties}
      >
        <span
          aria-hidden
          className={cn(
            "flex h-7 w-9 items-center justify-center bg-ink font-pixel-label text-[10px] text-white uppercase transition-transform duration-150 ease-[steps(3)]",
            checked && "translate-x-8",
          )}
        >
          {checked ? t("On") : t("Off")}
        </span>
      </button>
    </div>
  );
}
