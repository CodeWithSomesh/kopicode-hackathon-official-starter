import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/app/(auth)/next-path";
import { isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Google OAuth and email-confirmation redirect target. Exchanges the code for a session, then
 * continues to `next` (same-site paths only; default /onboarding, where Mochi takes over and sends
 * buyers who already finished on to /swipe).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (isDemoMode) return NextResponse.redirect(`${origin}${next}`);

  const back = (error: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", error);
    if (next !== "/onboarding") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  };

  // The provider sends ?error=access_denied when the buyer cancels on Google's screen.
  const providerError = searchParams.get("error");
  if (providerError) return back(providerError === "access_denied" ? "cancelled" : "google");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return back("link");
}
