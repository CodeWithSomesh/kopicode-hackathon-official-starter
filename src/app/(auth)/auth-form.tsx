"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { PixButton } from "@/components/homelander/pixel";
import { cn } from "@/lib/utils";
import { signIn, signUp, type AuthField, type AuthState } from "./actions";

const fieldCls =
  "pix-frame pix-flat h-12 w-full min-w-0 bg-transparent px-3.5 text-base text-ink placeholder:text-ink-soft/70 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-pandan-deep disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:shadow-[0_0_0_2px_var(--color-raya)]";

/** The email + password option, under "Continue with Google". Same server actions as before, Kopitiam fields. */
export function AuthForm({ mode, next, disabled }: { mode: "login" | "signup"; next: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, null);
  const invalid = (f: AuthField) => state?.error && state.field === f;
  const describedBy = (f: AuthField, hint?: string) =>
    cn(hint, invalid(f) && "auth-error", disabled && "auth-demo-note") || undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <fieldset disabled={disabled || pending} className="grid gap-4">
        <legend className="sr-only">{mode === "login" ? "Log in with email" : "Sign up with email"}</legend>
        {mode === "signup" && (
          <div className="grid gap-1.5">
            <label htmlFor="fullName" className="text-sm font-semibold text-ink">
              Your name <span className="font-normal text-ink-soft">(optional)</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              autoComplete="name"
              placeholder="Aisyah Rahman"
              defaultValue={state?.fullName}
              aria-invalid={invalid("fullName") || undefined}
              aria-describedby={describedBy("fullName")}
              className={fieldCls}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-ink">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            defaultValue={state?.email}
            aria-invalid={invalid("email") || undefined}
            aria-describedby={describedBy("email")}
            className={fieldCls}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-ink">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-invalid={invalid("password") || undefined}
            aria-describedby={describedBy("password", mode === "signup" ? "password-hint" : undefined)}
            className={fieldCls}
          />
          {mode === "signup" ? (
            <p id="password-hint" className="text-sm text-ink-soft">
              At least 6 characters.
            </p>
          ) : null}
        </div>

        {state?.error ? (
          <p id="auth-error" role="alert" className="border-l-4 border-raya bg-raya/10 px-3 py-2 text-sm font-medium text-raya-deep">
            {state.error}
          </p>
        ) : null}
        {state?.message ? (
          <p role="status" className="border-l-4 border-pandan bg-pandan/10 px-3 py-2 text-sm font-medium text-ink">
            {state.message}
          </p>
        ) : null}

        <PixButton type="submit" tone="ink" size="lg" className="w-full">
          {pending ? <Loader2Icon className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {pending ? "One moment…" : mode === "login" ? "Log in with email" : "Sign up with email"}
        </PixButton>
      </fieldset>
    </form>
  );
}
