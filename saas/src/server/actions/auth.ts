"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/env";
import { db } from "@/server/db";
import { claimAttempt, resetRateLimit } from "@/lib/rate-limit";
import { passwordProblem } from "@/lib/password-rules";
import { emailSchema, nameSchema } from "@/lib/schemas";
import { clientIp } from "@/server/client-ip";
import { verifyHuman } from "@/server/turnstile";
import { dummyVerify, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession, requireUserEvenIfLocked, safeNextPath } from "@/server/auth/session";
import { changePassword, checkResetToken, consumePasswordReset, createPasswordReset, signUpSchool } from "@/server/services/account";

export type FormState = { error: string | null; done?: boolean };

const MINUTE = 60 * 1000;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email.success || !password) return { error: "Enter your email and password." };

  const ip = await clientIp();
  if (!(await claimAttempt(`login:ip:${ip}`, 30, 15 * MINUTE)) || !(await claimAttempt(`login:acct:${email.data}`, 10, 15 * MINUTE))) {
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  }

  const user = await db().user.findUnique({
    where: { email: email.data },
    select: { id: true, passwordHash: true, isActive: true },
  });
  if (!user) {
    await dummyVerify(password);
    return { error: "Invalid email or password." };
  }
  if (!(await verifyPassword(user.passwordHash, password)) || !user.isActive) {
    return { error: user.isActive ? "Invalid email or password." : "This login has been switched off by your school admin." };
  }

  await resetRateLimit(`login:acct:${email.data}`);
  await db().user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  redirect(safeNextPath(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

const signupSchema = z.object({
  schoolName: z.string().trim().min(3, "Enter your school's name").max(150),
  name: nameSchema,
  email: emailSchema,
  password: z.string(),
  terms: z.literal("on", { error: "Accept the terms to continue" }),
});

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!env.SIGNUP_ENABLED) return { error: "New signups are paused. Please try again later." };
  // Honeypot: people never see this field; form-filling bots do.
  if (String(formData.get("website") ?? "")) return { error: "Something went wrong. Please try again." };

  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { schoolName, name, email, password } = parsed.data;

  const weak = passwordProblem(password, [name, email.split("@")[0], schoolName]);
  if (weak) return { error: weak };

  const ip = await clientIp();
  if (!(await claimAttempt(`signup:ip:${ip}`, 5, 60 * MINUTE)) || !(await claimAttempt("signup:global", 200, 60 * MINUTE))) {
    return { error: "Too many signups from here. Try again in an hour." };
  }
  if (!(await verifyHuman(formData.get("cf-turnstile-response"), ip))) {
    return { error: "Please complete the check above the button and try again." };
  }

  const result = await signUpSchool({ schoolName, name, email, password });
  if (!result.ok) return { error: result.message };
  await createSession(result.userId);
  redirect("/dashboard?welcome=1");
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email." };
  const ip = await clientIp();
  if (!(await claimAttempt(`forgot:ip:${ip}`, 10, 60 * MINUTE)) || !(await claimAttempt(`forgot:acct:${email.data}`, 3, 60 * MINUTE))) {
    return { error: "Too many requests. Try again in an hour." };
  }
  await createPasswordReset(email.data);
  return { error: null, done: true };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords do not match." };
  const weak = passwordProblem(password);
  if (weak) return { error: weak };
  if (!(await claimAttempt(`reset:ip:${await clientIp()}`, 20, 60 * MINUTE))) return { error: "Too many attempts. Try again later." };
  if (!(await checkResetToken(token)) || !(await consumePasswordReset(token, password))) {
    return { error: "This link has expired or was already used. Ask for a new one." };
  }
  redirect("/login?reset=1");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUserEvenIfLocked({ allowPasswordChange: true });
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) return { error: "The two new passwords do not match." };
  if (next === current) return { error: "Choose a password different from the current one." };
  const weak = passwordProblem(next, [user.name, user.email.split("@")[0], user.schoolName]);
  if (weak) return { error: weak };
  if (!(await claimAttempt(`chpw:${user.id}`, 10, 15 * MINUTE))) return { error: "Too many attempts. Wait 15 minutes." };

  const result = await changePassword(user.id, current, next, user.sessionId);
  if (!result.ok) return { error: result.message };
  if (user.mustChangePassword) redirect("/dashboard");
  return { error: null, done: true };
}
