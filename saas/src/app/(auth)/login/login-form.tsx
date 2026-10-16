"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/auth/fields";
import { loginAction, type FormState } from "@/server/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, { error: null });
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state.error} />
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <Link href="/forgot" className="text-muted-foreground text-center text-sm underline-offset-2 hover:underline">
        Forgot password?
      </Link>
    </form>
  );
}
