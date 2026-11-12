"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { syncNightVars } from "@/components/first-key/use-map-colors";
import { useHomeLanderTheme } from "@/lib/homelander/theme";
import { DARK_THEMES } from "@/lib/homelander/theme-config";

/** Teh Susu = light, Kopi O = dark on every route: the HomeLander theme cookie drives next-themes' `.dark` class for the shadcn pages (admin, dashboard, 404). */
function ThemeBridge() {
  const current = useHomeLanderTheme();
  const { setTheme } = useTheme();
  const path = usePathname();
  useEffect(syncNightVars, [path]);
  useEffect(() => {
    setTheme(DARK_THEMES.includes(current) ? "dark" : "light");
  }, [current, setTheme]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <ThemeBridge />
      {children}
      <Toaster richColors closeButton position="bottom-right" />
    </ThemeProvider>
  );
}
