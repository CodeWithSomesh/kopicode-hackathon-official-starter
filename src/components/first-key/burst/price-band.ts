import type { ThemeColors } from "../use-theme-colors";

// Cheap to dear. Colours come from theme tokens so every theme recolours the building.
export const BANDS = [
  { max: 450_000, label: "Under RM450k", token: "chart-4" },
  { max: 600_000, label: "RM450k - 600k", token: "chart-3" },
  { max: 750_000, label: "RM600k - 750k", token: "chart-2" },
  { max: Infinity, label: "Over RM750k", token: "chart-1" },
] as const satisfies readonly { max: number; label: string; token: keyof ThemeColors }[];

export const bandOf = (price: number) => BANDS.findIndex((b) => price < b.max);
