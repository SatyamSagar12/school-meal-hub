"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/auth/fields";
import { forgotPasswordAction, type FormState } from "@/server/actions/auth";

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, { error: null });
  if (state.done) {
    return <p className="bg-success-muted text-success rounded-lg px-3 py-2 text-sm">If that email has an account, a reset link is on its way. It works for one hour.</p>;
  }
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state.error} />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
