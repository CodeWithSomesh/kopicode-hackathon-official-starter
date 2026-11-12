"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { mainNav, secondaryNav, type NavItem } from "./nav";

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-0.5">
      {items.map((item) => {
        const active =
          item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              )}
            >
              <item.icon className={cn("size-4", active ? "text-sidebar-primary" : "opacity-70")} />
              {item.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarBody({ onNavigate, footer }: { onNavigate?: () => void; footer?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <Logo href="/dashboard" className="px-2 pt-1.5" />
      <nav className="flex flex-1 flex-col justify-between gap-6">
        <NavLinks items={mainNav} onNavigate={onNavigate} />
        <div className="grid gap-3">
          <NavLinks items={secondaryNav} onNavigate={onNavigate} />
          {footer}
        </div>
      </nav>
    </div>
  );
}

export function Sidebar({ footer }: { footer?: React.ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r bg-sidebar md:block">
      <SidebarBody footer={footer} />
    </aside>
  );
}

export function MobileSidebar({ footer }: { footer?: React.ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarBody footer={footer} />
      </SheetContent>
    </Sheet>
  );
}
