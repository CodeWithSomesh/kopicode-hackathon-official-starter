"use client";

import { PixButton, PixPanel } from "@/components/homelander/pixel";
import {
  PRESETS,
  STATS,
  type PresetId,
  type StatKey,
  type Weights,
} from "@/lib/homelander/analysis";
import { useT } from "@/lib/homelander/i18n/client";
import { cn } from "@/lib/utils";

export type WeightMode = PresetId | "custom";

/** Priority presets plus a slider per stat. Moving a slider switches to "Your own mix". */
export function Priorities({
  mode,
  weights,
  mochiWhy,
  hasProfile,
  skipped,
  onPreset,
  onWeight,
}: {
  mode: WeightMode;
  weights: Weights;
  mochiWhy: string[];
  hasProfile: boolean;
  /** Categories that can't be judged yet (missing inputs): slider disabled, with the reason. */
  skipped: Partial<Record<StatKey, string>>;
  onPreset: (p: PresetId) => void;
  onWeight: (k: StatKey, v: number) => void;
}) {
  const t = useT();
  const options: { id: PresetId; label: string }[] = [
    { id: "mochi", label: hasProfile ? "Mochi's mix for you" : "Balanced" },
    ...(Object.keys(PRESETS) as Exclude<PresetId, "mochi">[]).map((id) => ({
      id,
      label: PRESETS[id].label,
    })),
  ];
  const blurb =
    mode === "custom"
      ? t("Your own mix. Pick a preset to reset.")
      : mode === "mochi"
        ? hasProfile && mochiWhy.length
          ? t("Weighted from what you told Mochi: {list}.", { list: mochiWhy.map((w) => t(w)).join(", ") })
          : t("An even mix. Chat with Mochi and it bends to your life.")
        : t(PRESETS[mode].blurb);

  return (
    <PixPanel
      className="grid content-start gap-4 p-4"
      role="group"
      aria-labelledby="prio-title"
    >
      <div className="grid gap-1">
        <h2 id="prio-title" className="font-pixel text-xl leading-none">
          {t("What matters most?")}
        </h2>
        <p className="text-sm text-ink-soft">{blurb}</p>
      </div>
      <div
        className="flex flex-wrap gap-2.5"
        role="group"
        aria-label={t("Priority presets")}
      >
        {options.map((o) => (
          <PixButton
            key={o.id}
            size="sm"
            tone={mode === o.id ? "kaya" : "white"}
            aria-pressed={mode === o.id}
            onClick={() => onPreset(o.id)}
            className="text-[13px]"
          >
            {t(o.label)}
          </PixButton>
        ))}
      </div>
      <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-1">
        {STATS.map((s) => (
          <li
            key={s.key}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)_1.5rem] items-center gap-x-3"
          >
            <label
              htmlFor={`w-${s.key}`}
              className={cn(
                "text-sm font-semibold",
                skipped[s.key] && "text-ink-soft",
              )}
            >
              {t(s.label)}
            </label>
            <input
              id={`w-${s.key}`}
              type="range"
              min={0}
              max={10}
              step={1}
              value={weights[s.key]}
              onChange={(e) => onWeight(s.key, Number(e.target.value))}
              disabled={Boolean(skipped[s.key])}
              className="h-6 w-full cursor-pointer accent-pandan-deep disabled:cursor-not-allowed disabled:opacity-40"
              aria-describedby={`w-${s.key}-hint`}
            />
            <span className="text-right font-pixel text-base tabular-nums">
              {skipped[s.key] ? "–" : weights[s.key]}
            </span>
            {skipped[s.key] ? (
              <span
                id={`w-${s.key}-hint`}
                className="col-span-3 text-xs text-ink-soft"
              >
                {t("Sits out the fight: {why}.", { why: t(skipped[s.key] ?? "") })}
              </span>
            ) : (
              <span id={`w-${s.key}-hint`} className="sr-only">
                {t(s.hint)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </PixPanel>
  );
}
