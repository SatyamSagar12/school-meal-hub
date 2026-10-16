"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/auth/fields";
import { resetPasswordAction, type FormState } from "@/server/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, { error: null });
  return (
    <form action={action} className="mt-5 grid gap-4">
      <FormError message={state.error} />
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
      <Field label="New password again" name="confirm" type="password" autoComplete="new-password" required />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
