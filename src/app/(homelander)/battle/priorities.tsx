"use client";

import { PixButton, PixPanel } from "@/components/homelander/pixel";
import {
  PRESETS,
  STATS,
  type PresetId,
  type StatKey,
  type Weights,
} from "@/lib/homelander/analysis";

export type WeightMode = PresetId | "custom";

/** Priority presets plus a slider per stat. Moving a slider switches to "Your own mix". */
export function Priorities({
  mode,
  weights,
  uncleWhy,
  hasProfile,
  onPreset,
  onWeight,
}: {
  mode: WeightMode;
  weights: Weights;
  uncleWhy: string[];
  hasProfile: boolean;
  onPreset: (p: PresetId) => void;
  onWeight: (k: StatKey, v: number) => void;
}) {
  const options: { id: PresetId; label: string }[] = [
    { id: "uncle", label: hasProfile ? "Uncle's mix for you" : "Balanced" },
    ...(Object.keys(PRESETS) as Exclude<PresetId, "uncle">[]).map((id) => ({
      id,
      label: PRESETS[id].label,
    })),
  ];
  const blurb =
    mode === "custom"
      ? "Your own mix. Pick a preset to reset."
      : mode === "uncle"
        ? hasProfile && uncleWhy.length
          ? `Weighted from what you told Uncle: ${uncleWhy.join(", ")}.`
          : "An even mix. Sit with Uncle and it bends to your life."
        : PRESETS[mode].blurb;

  return (
    <PixPanel
      className="grid content-start gap-4 p-4"
      role="group"
      aria-labelledby="prio-title"
    >
      <div className="grid gap-1">
        <h2 id="prio-title" className="font-pixel text-xl leading-none">
          What matters most?
        </h2>
        <p className="text-sm text-ink-soft">{blurb}</p>
      </div>
      <div
        className="flex flex-wrap gap-2.5"
        role="group"
        aria-label="Priority presets"
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
            {o.label}
          </PixButton>
        ))}
      </div>
      <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-1">
        {STATS.map((s) => (
          <li
            key={s.key}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)_1.5rem] items-center gap-3"
          >
            <label htmlFor={`w-${s.key}`} className="text-sm font-semibold">
              {s.label}
            </label>
            <input
              id={`w-${s.key}`}
              type="range"
              min={0}
              max={10}
              step={1}
              value={weights[s.key]}
              onChange={(e) => onWeight(s.key, Number(e.target.value))}
              className="h-6 w-full cursor-pointer accent-pandan-deep"
              aria-describedby={`w-${s.key}-hint`}
            />
            <span className="text-right font-pixel text-base tabular-nums">
              {weights[s.key]}
            </span>
            <span id={`w-${s.key}-hint`} className="sr-only">
              {s.hint}
            </span>
          </li>
        ))}
      </ul>
    </PixPanel>
  );
}
