"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/auth/fields";
import { changePasswordAction, type FormState } from "@/server/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

export function ChangePasswordForm({ currentLabel }: { currentLabel: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, { error: null });
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state.error} />
      {state.done ? <p className="bg-success-muted text-success rounded-lg px-3 py-2 text-sm">Password changed. Other devices have been signed out.</p> : null}
      <Field label={currentLabel} name="current" type="password" autoComplete="current-password" required />
      <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required hint={`At least ${MIN_PASSWORD_LENGTH} characters.`} />
      <Field label="New password again" name="confirm" type="password" autoComplete="new-password" required />
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
