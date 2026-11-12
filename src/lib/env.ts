/**
 * Central place to read env vars. Everything degrades gracefully:
 * - No Supabase vars  -> "demo mode": app runs on mock data, auth is bypassed.
 * - No AI key         -> on Vercel the AI Gateway uses the project's OIDC token;
 *                        locally set AI_GATEWAY_API_KEY in .env.local.
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "",
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
  aiModel: process.env.AI_MODEL ?? "anthropic/claude-sonnet-5.5",
};

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);

export const isDemoMode = !isSupabaseConfigured;
