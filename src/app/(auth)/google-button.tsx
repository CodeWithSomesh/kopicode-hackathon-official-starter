"use client";

import { useState } from "react";
import { Loader2Icon } from "lucide-react";
import { PixButton } from "@/components/homelander/pixel";

/** Google's "G" in its own brand colours (allowed for the sign-in button). */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Supabase OAuth with Google. Supabase sends the buyer to Google, then back to /auth/callback,
 * which swaps the code for a session and continues to `next`.
 */
export function GoogleButton({ next, disabled }: { next: string; disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setPending(true);
    setError(null);
    try {
      // Loaded on click so demo mode (no Supabase keys) never builds a client.
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
      // On success the browser is already on its way to Google.
    } catch {
      setPending(false);
      setError("We couldn't reach Google just now. Try again in a moment, or use your email below.");
    }
  }

  return (
    <div className="grid gap-2">
      <PixButton
        type="button"
        size="lg"
        className="w-full font-sans"
        onClick={go}
        disabled={disabled || pending}
        aria-describedby={disabled ? "auth-demo-note" : error ? "google-error" : undefined}
      >
        {pending ? <Loader2Icon className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : <GoogleG />}
        {pending ? "Opening Google…" : "Continue with Google"}
      </PixButton>
      {error ? (
        <p id="google-error" role="alert" className="text-sm font-medium text-raya-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
