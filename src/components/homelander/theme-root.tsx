import { cookies } from "next/headers";
import { HomeLanderThemeProvider } from "@/lib/homelander/theme";
import { LOCKED_THEME, THEME_COOKIE, parseTheme } from "@/lib/homelander/theme-config";
import { cn } from "@/lib/utils";
import { homelanderFontClass } from "./fonts";
import "@/app/(homelander)/themes.css";

/** The element every HomeLander screen sits in. It carries the fonts and the chosen theme (data-jtheme, from a cookie). */
export async function HomeLanderThemeRoot({ className, children }: { className?: string; children: React.ReactNode }) {
  const theme = LOCKED_THEME ?? parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div data-jtheme={theme} className={cn(homelanderFontClass, "homelander-world bg-sky", className)}>
      <HomeLanderThemeProvider initial={theme}>{children}</HomeLanderThemeProvider>
    </div>
  );
}
