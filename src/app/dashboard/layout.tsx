import { DemoBanner } from "@/components/app/demo-banner";
import { MobileSidebar, Sidebar } from "@/components/app/sidebar";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { UserMenu } from "@/components/app/user-menu";
import { getCurrentUser } from "@/lib/auth";

/** Shared app shell. Every feature page lives under /dashboard. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:px-6">
          <MobileSidebar />
          <div className="flex-1" />
          <ThemeToggle />
          <UserMenu name={user.name} email={user.email} avatarUrl={user.avatarUrl} isDemo={user.isDemo} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
