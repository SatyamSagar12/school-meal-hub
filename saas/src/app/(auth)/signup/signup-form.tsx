"use client";

import Link from "next/link";
import Script from "next/script";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/auth/fields";
import { signupAction, type FormState } from "@/server/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

export function SignupForm({ turnstileSiteKey }: { turnstileSiteKey: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, { error: null });
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state.error} />
      <Field label="School name" name="schoolName" required placeholder="e.g. GPS Rampur" />
      <Field label="Your name" name="name" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} />
      {/* Honeypot: hidden from people, filled by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="terms" required className="mt-1" />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="underline" target="_blank">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline" target="_blank">
            privacy policy
          </Link>
          .
        </span>
      </label>
      {turnstileSiteKey ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />
        </>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating your school…" : "Create my school"}
      </Button>
    </form>
  );
}
