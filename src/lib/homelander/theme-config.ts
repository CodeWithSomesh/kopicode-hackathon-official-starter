/** Theme list and boot script, importable from server and client code. */

export const themes = [
  {
    id: "ledger",
    group: "Professional, with game touches",
    name: "Ledger",
    blurb: "A calm banking app with small game rewards: crisp cards and plain type, with pixel badges and XP bars as the only play.",
    swatches: ["#f4f5f7", "#101828", "#17a061", "#f5b301"],
  },
  {
    id: "quest",
    group: "Professional, with game touches",
    name: "Quest",
    blurb: "Friendly and chunky, like Duolingo: rounded cards, buttons that press down, bold rounded type.",
    swatches: ["#f4f6fb", "#1d2433", "#58cc02", "#1cb0f6"],
  },
  {
    id: "kopitiam",
    group: "Kopitiam",
    name: "Teh Susu",
    blurb: "Light and milky: white wall tiles, a jade tile band, enamel-pill buttons. The default.",
    swatches: ["#f4f8f5", "#17332a", "#1f9d6b", "#d8452f"],
  },
  {
    id: "kopio",
    group: "Kopitiam",
    name: "Kopi O",
    blurb: "The same kopitiam after dark: strong black coffee, cream text, jade and kaya lights, a night map.",
    swatches: ["#17100c", "#f6ede1", "#3fbf8a", "#f2b632"],
  },
  {
    id: "brutal",
    group: "Bold and playful",
    name: "Brutal",
    blurb: "Neo-brutalist: sunny yellow, thick black outlines, hard drop shadows, hot pink and electric blue.",
    swatches: ["#ffe66d", "#000000", "#ff90e8", "#3a86ff"],
  },
  {
    id: "bubblegum",
    group: "Bold and playful",
    name: "Bubblegum",
    blurb: "Soft and sweet: pink, lilac and mint, pillowy rounded cards, round friendly type.",
    swatches: ["#ffe8f3", "#3b1f4a", "#ff5c8a", "#3ccf91"],
  },
  {
    id: "night",
    group: "Bold and playful",
    name: "Night Market",
    blurb: "Dark mode under pasar malam lanterns: deep indigo, warm orange and teal light, a dark map.",
    swatches: ["#12101c", "#f3efff", "#ffb547", "#2dd4a7"],
  },
  {
    id: "arcade",
    group: "Bold and playful",
    name: "Arcade",
    blurb: "Full-colour 8-bit: sky, clouds and a KL skyline, pixel frames and pixel type. The first version.",
    swatches: ["#9fd8ff", "#2b1d3f", "#3fbf5f", "#ffcf3f"],
  },
] as const;

/** Themes that show unit photos pixelated. */
export const PIXEL_THEMES: readonly string[] = ["arcade"];

export type ThemeId = (typeof themes)[number]["id"];

/** Teh Susu (id "kopitiam", light) is the default; Kopi O (id "kopio") is its dark twin. */
export const DEFAULT_THEME: ThemeId = "kopitiam";

/** Themes that render dark: the map follows them as night. */
export const DARK_THEMES: readonly string[] = ["kopio", "night"];

/**
 * 5pm challenge: the switcher is unlocked (every theme). Set an id here to pin the app to one theme again (cookie ignored,
 * switcher hidden).
 */
export const LOCKED_THEME: ThemeId | null = null;

export const THEME_COOKIE = "homelander-theme";

export function parseTheme(v: string | undefined | null): ThemeId {
  return themes.some((t) => t.id === v) ? (v as ThemeId) : DEFAULT_THEME;
}
