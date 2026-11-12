import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Email confirmation / OAuth redirect target. Exchanges the code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";

  if (isDemoMode) return NextResponse.redirect(`${origin}/dashboard`);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=Could%20not%20verify%20your%20link`);
}
