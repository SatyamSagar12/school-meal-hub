import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { db } from "@/server/db";
import { hmac, randomToken } from "@/server/crypto";
import { billingState, type BillingState } from "@/lib/billing-state";

/**
 * Sessions: a random token in an httpOnly cookie, its HMAC in the database.
 * A leaked database row cannot be replayed as a cookie.
 *
 * Longer-lived than Docchase's (which guards client documents and has MFA):
 * a teacher marks attendance from the same phone every school day and should
 * not be signing in each morning. 30 days absolute, 14 days idle.
 */

const ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
const IDLE_MS = 14 * 24 * 60 * 60 * 1000;
/** lastSeenAt is written at most this often: a write per page view would be most of D1's write budget. */
const TOUCH_MS = 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  sessionId: string;
  schoolId: string;
  email: string;
  name: string;
  role: "ADMIN" | "TEACHER";
  mustChangePassword: boolean;
  schoolName: string;
  billing: BillingState;
  isPlatformAdmin: boolean;
};

async function cookieName(): Promise<string> {
  // __Host- needs https; plain http on localhost uses the bare name.
  return env.APP_URL.startsWith("https://") ? "__Host-mdm_session" : "mdm_session";
}

function hashToken(token: string): string {
  return hmac(env.SESSION_SECRET, `session:${token}`);
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const h = await headers();
  await db().session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ABSOLUTE_MS),
      ip: h.get("cf-connecting-ip") ?? null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(await cookieName(), token, {
    httpOnly: true,
    secure: env.APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const name = await cookieName();
  const token = jar.get(name)?.value;
  if (token) await db().session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(name);
}

/** The signed-in user, or null. One query, deduplicated per request. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(await cookieName())?.value;
  if (!token) return null;

  const session = await db().session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          school: {
            select: {
              id: true,
              name: true,
              plan: true,
              trialEndsAt: true,
              paidUntil: true,
              billingExempt: true,
              suspendedAt: true,
            },
          },
        },
      },
    },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.lastSeenAt.getTime() + IDLE_MS <= now || !session.user.isActive) {
    await db().session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.lastSeenAt.getTime() + TOUCH_MS <= now) {
    await db().session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } });
  }

  const { user } = session;
  return {
    id: user.id,
    sessionId: session.id,
    schoolId: user.school.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    schoolName: user.school.name,
    billing: billingState(user.school),
    isPlatformAdmin: user.school.billingExempt && env.PLATFORM_ADMIN_EMAILS.includes(user.email.toLowerCase()),
  };
});

/**
 * The guard for every school page and action. Pages and actions call this
 * themselves; nothing upstream is trusted to have checked.
 *
 *  - not signed in        -> /login
 *  - temporary password   -> /account (must choose their own first)
 *  - school locked        -> /billing
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await requireUserEvenIfLocked();
  if (user.billing.locked) redirect("/billing");
  return user;
}

/** For the billing and account pages, which must work while locked. */
export async function requireUserEvenIfLocked(options: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !options.allowPasswordChange) redirect("/account?first=1");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** Only ever a same-site path: an open redirect after sign-in is a phishing aid. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}
