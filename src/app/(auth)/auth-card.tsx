import Link from "next/link";
import { PixButton, PixPanel } from "@/components/homelander/pixel";
import { isDemoMode } from "@/lib/env";
import { getT } from "@/lib/homelander/i18n/server";
import type { TFn } from "@/lib/homelander/i18n/translate";
import { AuthForm } from "./auth-form";
import { GoogleButton } from "./google-button";
import { authErrorText, DEFAULT_NEXT } from "./next-path";

/** i18n marker: t() is called on these at render. */
const tr = (s: string) => s;

const copy = {
  login: {
    title: tr("Welcome back"),
    lead: tr("Log in and Mochi will pick up where you left off."),
    divider: tr("or log in with email"),
    switchText: tr("New to HomeLander?"),
    switchLink: tr("Create an account"),
    switchHref: "/signup",
  },
  signup: {
    title: tr("Create your account"),
    lead: tr("Save your answers, your liked homes and your bank check, on any device."),
    divider: tr("or sign up with email"),
    switchText: tr("Already have an account?"),
    switchLink: tr("Log in"),
    switchHref: "/login",
  },
} as const;

/** The form card both auth pages share: Google first, email and password second. */
export async function AuthCard({ mode, next, error }: { mode: "login" | "signup"; next: string; error?: unknown }) {
  const t = await getT();
  const c = copy[mode];
  const errorText = authErrorText(error);
  const switchHref = next === DEFAULT_NEXT ? c.switchHref : `${c.switchHref}?next=${encodeURIComponent(next)}`;

  return (
    <PixPanel className="grid gap-6 p-5 sm:p-7">
      <div className="grid gap-1.5">
        <h1 className="font-pixel text-[1.75rem] leading-tight sm:text-3xl text-ink">{t(c.title)}</h1>
        <p className="text-base text-ink-soft">{t(c.lead)}</p>
      </div>

      {isDemoMode ? <DemoNote t={t} /> : null}

      {errorText ? (
        <p role="alert" className="border-l-4 border-raya bg-raya/10 px-3 py-2 text-sm font-medium text-raya-deep">
          {t(errorText)}
        </p>
      ) : null}

      <GoogleButton next={next} disabled={isDemoMode} />

      <div className="flex items-center gap-3 text-sm text-ink-soft" role="presentation">
        <span className="h-px flex-1 bg-ink/20" />
        {t(c.divider)}
        <span className="h-px flex-1 bg-ink/20" />
      </div>

      <AuthForm mode={mode} next={next} disabled={isDemoMode} />

      <p className="text-center text-sm text-ink-soft">
        {t(c.switchText)}{" "}
        <Link href={switchHref} className="font-semibold text-pandan-deep underline underline-offset-4 hover:text-ink">
          {t(c.switchLink)}
        </Link>
      </p>
    </PixPanel>
  );
}

/** Demo mode (no Supabase keys): say so plainly and offer the way in that does work. */
function DemoNote({ t }: { t: TFn }) {
  return (
    <PixPanel flat tone="sky" className="grid gap-3 p-4" id="auth-demo-note">
      <div className="grid gap-1">
        <p className="font-semibold text-ink">{t("Accounts aren't switched on yet in this demo")}</p>
        <p className="text-sm text-ink-soft">
          {t("Google and email sign-in will work once the team connects accounts. Until then you can try everything, and Mochi keeps your answers on this device.")}
        </p>
      </div>
      <PixButton asChild tone="pandan" size="md" className="w-full py-2 text-center leading-tight whitespace-normal!">
        <Link href="/onboarding">{t("Continue without an account")}</Link>
      </PixButton>
    </PixPanel>
  );
}
