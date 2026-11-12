"use client";

import { useEffect, useRef, useState } from "react";
import { setTheme, themes, useHomeLanderTheme } from "@/lib/homelander/theme";
import { cn } from "@/lib/utils";
import { PixPanel } from "./pixel";

function Swatches({
  colors,
  size = "sm",
}: {
  colors: readonly string[];
  size?: "sm" | "md";
}) {
  return (
    <span aria-hidden className="flex">
      {colors.map((c, i) => (
        <span
          key={c}
          className={cn(
            "rounded-full ring-2 ring-white",
            size === "sm" ? "size-3.5" : "size-5",
            i > 0 && (size === "sm" ? "-ml-1" : "-ml-1.5"),
          )}
          style={{ background: c }}
        />
      ))}
    </span>
  );
}

const groups = [...new Set(themes.map((t) => t.group))];

/** Lets the team flip between design themes on the real screens. */
export function ThemeSwitcher({
  align = "right",
}: {
  align?: "left" | "right";
}) {
  const current = useHomeLanderTheme();
  const active = themes.find((t) => t.id === current) ?? themes[0];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="pointer-events-auto relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Design theme: ${active.name}. Change theme`}
        onClick={() => setOpen((o) => !o)}
        className="block"
      >
        <PixPanel flat className="flex h-8 items-center gap-2 px-2.5">
          <Swatches colors={active.swatches} />
          <span className="hidden font-pixel text-sm leading-none sm:inline">
            {active.name}
          </span>
        </PixPanel>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose a design theme"
          className={cn(
            "z-50 max-sm:fixed max-sm:inset-x-4 max-sm:top-16 sm:absolute sm:top-full sm:mt-3 sm:w-[360px]",
            align === "right" ? "sm:right-0" : "sm:left-0",
          )}
        >
          <PixPanel className="grid max-h-[min(640px,calc(100svh-7rem))] gap-1 overflow-y-auto p-2">
            <p className="px-2 pt-1.5 pb-1 text-xs text-ink-soft">
              Design themes for the team to compare. Same screens, same data.
            </p>
            {groups.map((g) => (
              <div key={g} className="grid gap-1">
                <p className="px-2 pt-2 font-pixel-label text-[11px] text-ink-soft uppercase">
                  {g}
                </p>
                {themes
                  .filter((t) => t.group === g)
                  .map((t) => {
                    const on = t.id === current;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setTheme(t.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "grid grid-cols-[auto_1fr] items-start gap-3 rounded-[inherit] p-2.5 text-left transition-colors",
                          on ? "bg-cloud" : "hover:bg-cloud/60",
                        )}
                      >
                        <span className="pt-0.5">
                          <Swatches colors={t.swatches} size="md" />
                        </span>
                        <span className="grid gap-0.5">
                          <span className="flex items-center gap-2 font-pixel text-base leading-tight font-bold">
                            {t.name}
                            {on ? (
                              <span className="text-xs font-normal text-ink-soft">
                                Current
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[13px] leading-snug text-ink-soft">
                            {t.blurb}
                          </span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </PixPanel>
        </div>
      ) : null}
    </div>
  );
}
