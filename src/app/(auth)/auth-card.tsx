import Link from "next/link";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { isDemoMode } from "@/lib/env";
import { AuthForm } from "./auth-form";
import { GoogleButton } from "./google-button";
import { authErrorText, DEFAULT_NEXT } from "./next-path";

const copy = {
  login: {
    title: "Welcome back",
    lead: "Log in and Mochi will pick up where you left off.",
    divider: "or log in with email",
    switchText: "New to HomeLander?",
    switchLink: "Create an account",
    switchHref: "/signup",
  },
  signup: {
    title: "Create your account",
    lead: "Save your answers, your liked homes and your bank check, on any device.",
    divider: "or sign up with email",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
  },
} as const;

/** The form card both auth pages share: Google first, email and password second. */
export function AuthCard({ mode, next, error }: { mode: "login" | "signup"; next: string; error?: unknown }) {
  const c = copy[mode];
  const errorText = authErrorText(error);
  const switchHref = next === DEFAULT_NEXT ? c.switchHref : `${c.switchHref}?next=${encodeURIComponent(next)}`;

  return (
    <PixPanel className="grid gap-6 p-5 sm:p-7">
      <div className="grid gap-1.5">
        <h1 className="font-pixel text-[1.75rem] leading-tight sm:text-3xl text-ink">{c.title}</h1>
        <p className="text-base text-ink-soft">{c.lead}</p>
      </div>

      {isDemoMode ? <DemoNote /> : null}

      {errorText ? (
        <p role="alert" className="border-l-4 border-raya bg-raya/10 px-3 py-2 text-sm font-medium text-raya-deep">
          {errorText}
        </p>
      ) : null}

      <GoogleButton next={next} disabled={isDemoMode} />

      <div className="flex items-center gap-3 text-sm text-ink-soft" role="presentation">
        <span className="h-px flex-1 bg-ink/20" />
        {c.divider}
        <span className="h-px flex-1 bg-ink/20" />
      </div>

      <AuthForm mode={mode} next={next} disabled={isDemoMode} />

      <p className="text-center text-sm text-ink-soft">
        {c.switchText}{" "}
        <Link href={switchHref} className="font-semibold text-pandan-deep underline underline-offset-4 hover:text-ink">
          {c.switchLink}
        </Link>
      </p>
    </PixPanel>
  );
}

/** Demo mode (no Supabase keys): say so plainly and offer the way in that does work. */
function DemoNote() {
  return (
    <PixPanel flat tone="sky" className="grid gap-3 p-4" id="auth-demo-note">
      <div className="grid gap-1">
        <p className="font-semibold text-ink">Accounts aren&apos;t switched on yet in this demo</p>
        <p className="text-sm text-ink-soft">
          Google and email sign-in will work once the team connects accounts. Until then you can try
          everything, and Mochi keeps your answers on this device.
        </p>
      </div>
      <PixButton asChild tone="pandan" size="md" className="w-full py-2 text-center leading-tight whitespace-normal!">
        <Link href="/onboarding">Continue without an account</Link>
      </PixButton>
    </PixPanel>
  );
}
