import { Logo } from "@/components/app/logo";
import { isDemoMode } from "@/lib/env";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh place-items-center bg-muted/30 px-4 py-10">
      <div className="grid w-full max-w-sm gap-6">
        <Logo className="justify-self-center" />
        <div className="rounded-xl border bg-card p-6 shadow-xs">{children}</div>
        {isDemoMode ? (
          <p className="text-center text-xs text-muted-foreground">
            Supabase isn&apos;t configured, so any submit opens the demo dashboard.
          </p>
        ) : null}
      </div>
    </div>
  );
}
