"use client";

import { ThemeSwitcher } from "@/components/homelander/theme-switcher";
import { useHomeLanderTheme } from "@/lib/homelander/theme";
import "@/app/(homelander)/themes.css";

/** Header theme control for the non-HomeLander shells (admin): the same Teh Susu | Kopi O toggle. It sits in a small themed scope so its pixel frame follows the theme; ThemeBridge (providers.tsx) restyles the page itself. */
export function ThemeToggle() {
  const current = useHomeLanderTheme();
  return (
    <div className="homelander-world !bg-transparent" data-jtheme={current} data-embedded>
      <ThemeSwitcher />
    </div>
  );
}
