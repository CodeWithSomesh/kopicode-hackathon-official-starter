import {
  LayoutDashboardIcon,
  ListChecksIcon,
  SettingsIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { title: string; href: string; icon: LucideIcon };

/**
 * Sidebar navigation. Each team member adds ONE line here for their feature
 * page (e.g. /dashboard/feature-1). Keep the order = the demo story order.
 */
export const mainNav: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Items", href: "/dashboard/items", icon: ListChecksIcon },
  { title: "Assistant", href: "/dashboard/assistant", icon: SparklesIcon },
];

export const secondaryNav: NavItem[] = [
  { title: "Settings", href: "/dashboard/settings", icon: SettingsIcon },
];
