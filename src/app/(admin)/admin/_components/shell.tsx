import { LanguageToggle } from "@/components/homelander/language-toggle";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/homelander/i18n/server";
import { sections } from "./nav";

function Mark() {
  return (
    <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground" aria-hidden>
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-5h4v5" />
      </svg>
    </span>
  );
}

/** Sidebar of section anchors on desktop, a slim top bar on every size. */
export async function AdminShell({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh flex-col border-r bg-card/40 lg:flex" aria-label={t("Dashboard sections")}>
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <Mark />
          <div className="grid leading-tight">
            <span className="text-sm font-semibold">HomeLander</span>
            <span className="text-xs text-muted-foreground">{t("Gamuda Land admin")}</span>
          </div>
        </div>
        <nav className="grid gap-0.5 overflow-y-auto p-3">
          <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">{t("Buyer insights")}</p>
          {sections.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Icon className="size-4" aria-hidden />
              {t(label)}
            </a>
          ))}
        </nav>
        <div className="mt-auto border-t p-4 text-xs leading-relaxed text-muted-foreground">
          {t("Sample data is generated from Gamuda Land's real projects and labelled. Live data is this browser's own HomeLander session.")}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <Mark />
          </div>
          <nav aria-label={t("Breadcrumb")} className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{t("Gamuda Land")}</span>
            <span className="hidden text-muted-foreground sm:inline" aria-hidden>/</span>
            <span className="truncate font-medium">{t("HomeLander buyer insights")}</span>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <Button asChild variant="outline" size="sm">
              <Link href="/swipe">
                {t("Buyer app")}
                <ArrowUpRightIcon aria-hidden />
              </Link>
            </Button>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 pt-6 pb-16 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
