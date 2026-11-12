/**
 * Where to send a buyer after they sign in. The server can't see the client's onboarding status
 * (it lives in localStorage), so the default is /onboarding: Mochi picks up from there, and a buyer
 * who already finished is sent on to /swipe by the app.
 */
export const DEFAULT_NEXT = "/onboarding";

const BASE = "http://homelander.invalid";

/** Only same-site relative paths, never back into the auth pages; anything else falls back to /onboarding. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return DEFAULT_NEXT;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return DEFAULT_NEXT;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return DEFAULT_NEXT;
  }
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return DEFAULT_NEXT;
  }
  if (url.origin !== BASE) return DEFAULT_NEXT;
  if (url.pathname === "/login" || url.pathname === "/signup" || url.pathname.startsWith("/auth/")) return DEFAULT_NEXT;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Error codes the callback puts on /login?error=…, turned into plain words (never echo raw query text). */
export const AUTH_ERRORS: Record<string, string> = {
  link: "That sign-in link didn't work, or it has expired. Try logging in again, or ask for a new link by signing up.",
  google: "Google sign-in didn't finish. Try again, or use your email and password below.",
  cancelled: "Google sign-in was cancelled. Pick an option below when you're ready.",
};

export function authErrorText(code: unknown): string | null {
  if (typeof code !== "string" || !code) return null;
  return AUTH_ERRORS[code] ?? "Something went wrong while signing you in. Please try again.";
}
