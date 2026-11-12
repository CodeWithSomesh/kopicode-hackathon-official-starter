"use client";

import { setMapDusk, setMapNight } from "@/components/first-key/use-map-colors";
import { useT } from "@/lib/homelander/i18n/client";
import { setTheme, useHomeLanderTheme, type ThemeId } from "@/lib/homelander/theme";
import { DARK_THEMES } from "@/lib/homelander/theme-config";
import { cn } from "@/lib/utils";
import { PixPanel } from "./pixel";

/** Teh Susu: a tall glass of milky tea, tan drink, cream foam. */
function TehSusuIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0" shapeRendering="crispEdges">
      <path d="M3 3h10l-1 11H4z" fill="#fffaf0" stroke="#17332a" strokeWidth="1" />
      <path d="M3.6 6h8.8l-.7 7.5H4.3z" fill="#c9954f" />
      <path d="M3.3 4h9.4v2H3.3z" fill="#f3e3c3" />
      <path d="M9 1l1 2" stroke="#d8452f" strokeWidth="1" />
    </svg>
  );
}

/** Kopi O: a small cup of black coffee with a handle and steam. */
function KopiOIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4 shrink-0" shapeRendering="crispEdges">
      <path d="M2 6h9v5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" fill="#fffaf0" stroke="#17332a" strokeWidth="1" />
      <path d="M2.5 6.5h8v1.5h-8z" fill="#17100c" />
      <path d="M11 7h1.5a1.5 1.5 0 0 1 0 3H11" fill="none" stroke="#17332a" strokeWidth="1" />
      <path d="M5 4V2M8 4V2" stroke="#17332a" strokeWidth="1" />
    </svg>
  );
}

const options: { id: ThemeId; name: string; Icon: () => React.JSX.Element }[] = [
  { id: "kopitiam", name: "Teh Susu", Icon: TehSusuIcon },
  { id: "kopio", name: "Kopi O", Icon: KopiOIcon },
];

/** "Teh Susu | Kopi O" light/dark toggle for the header, same shape as the language toggle. */
export function ThemeSwitcher() {
  const current = useHomeLanderTheme();
  const tr = useT();
  return (
    <PixPanel flat className="pointer-events-auto flex h-8 items-center gap-0.5 p-0.5" role="group" aria-label={tr("Design theme")}>
      {options.map(({ id, name, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={current === id}
          aria-label={name}
          onClick={() => {
            if (current === id) return;
            setTheme(id);
            // The map follows the theme: Kopi O opens it at night. Its own button overrides.
            setMapNight(DARK_THEMES.includes(id));
            setMapDusk(false);
          }}
          className={cn(
            "flex h-full items-center gap-1.5 rounded-[inherit] px-2 font-pixel text-xs leading-none whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring max-sm:px-1.5 max-sm:text-[11px]",
            current === id ? "bg-kaya text-ink" : "text-ink-soft hover:bg-cloud",
          )}
        >
          <Icon />
          <span className="max-sm:hidden">{name}</span>
        </button>
      ))}
    </PixPanel>
  );
}
