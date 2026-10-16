import "server-only";
import { env } from "@/env";
import { db } from "@/server/db";
import { hmac, randomToken } from "@/server/crypto";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { sendMail } from "@/server/services/mail";
import { TRIAL_DAYS } from "@/lib/plans";
import { TERMS_VERSION } from "@/server/legal";

const RESET_TTL_MS = 60 * 60 * 1000;

function academicYearFor(now = new Date()): string {
  // Indian schools start the year in April.
  const y = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${start + 1}`;
}

/**
 * Creates the school and its first admin, signed up on the spot.
 *
 * Unlike Docchase there is no email-verification step: the account holds
 * one school's meal register and nothing anyone else uploaded, and a
 * teacher who cannot get through signup on a phone in one go does not come
 * back. Platform access is NOT granted by email alone (it also needs a
 * billing-exempt school, set by hand), so an unverified address unlocks
 * nothing beyond the new school itself.
 */
export async function signUpSchool(input: { schoolName: string; name: string; email: string; password: string }) {
  if (await db().user.findUnique({ where: { email: input.email }, select: { id: true } })) {
    return { ok: false as const, message: "That email already has an account. Sign in instead." };
  }
  const now = new Date();
  const school = await db().school.create({
    data: {
      name: input.schoolName,
      academicYear: academicYearFor(now),
      plan: "TRIAL",
      trialEndsAt: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: now,
    },
    select: { id: true },
  });
  try {
    const user = await db().user.create({
      data: {
        schoolId: school.id,
        name: input.name,
        email: input.email,
        role: "ADMIN",
        passwordHash: await hashPassword(input.password),
        lastLoginAt: now,
      },
      select: { id: true },
    });
    return { ok: true as const, userId: user.id };
  } catch (error) {
    // Lost a race on the same email: undo the school (no transactions on D1).
    await db().school.delete({ where: { id: school.id } }).catch(() => undefined);
    throw error;
  }
}

export async function changePassword(userId: string, current: string, next: string, keepSessionId: string) {
  const user = await db().user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!(await verifyPassword(user.passwordHash, current))) return { ok: false as const, message: "Your current password is not right." };
  await db().user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  });
  // Every other device is signed out; this one stays.
  await db().session.deleteMany({ where: { userId, id: { not: keepSessionId } } });
  return { ok: true as const };
}

function resetHash(token: string) {
  return hmac(env.TOKEN_SECRET, `reset:${token}`);
}

/**
 * Emails a reset link if the address has an account. The caller shows the
 * same message either way, so this cannot be used to find out who is
 * signed up.
 */
export async function createPasswordReset(email: string): Promise<void> {
  const user = await db().user.findUnique({ where: { email }, select: { id: true, isActive: true, name: true } });
  if (!user || !user.isActive) return;
  await db().passwordResetToken.deleteMany({ where: { userId: user.id } });
  const token = randomToken();
  await db().passwordResetToken.create({
    data: { userId: user.id, tokenHash: resetHash(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });
  await sendMail(
    email,
    `Reset your ${env.APP_NAME} password`,
    `Hello ${user.name},\n\nOpen this link within an hour to choose a new password:\n\n${env.APP_URL}/reset/${token}\n\nIf you did not ask for this, ignore this email; your password has not changed.`,
  );
}

export async function checkResetToken(token: string): Promise<boolean> {
  const row = await db().passwordResetToken.findUnique({ where: { tokenHash: resetHash(token) }, select: { usedAt: true, expiresAt: true } });
  return Boolean(row && !row.usedAt && row.expiresAt.getTime() > Date.now());
}

/** Claims the token atomically (one conditional update), then sets the password and signs out everywhere. */
export async function consumePasswordReset(token: string, password: string): Promise<boolean> {
  const tokenHash = resetHash(token);
  const { count } = await db().passwordResetToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (count !== 1) return false;
  const row = await db().passwordResetToken.findUniqueOrThrow({ where: { tokenHash }, select: { userId: true } });
  await db().user.update({
    where: { id: row.userId },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false },
  });
  await db().session.deleteMany({ where: { userId: row.userId } });
  return true;
}
