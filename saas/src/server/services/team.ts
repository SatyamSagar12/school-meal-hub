import "server-only";
import { db } from "@/server/db";
import { generateTemporaryPassword, hashPassword } from "@/server/auth/password";
import { limitsFor } from "@/lib/plans";

export async function listTeam(schoolId: string) {
  return db().user.findMany({
    where: { schoolId },
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, mustChangePassword: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

export type TeamResult = { ok: true; tempPassword?: string } | { ok: false; message: string };

/**
 * Adds a teacher with a temporary password the admin passes on in person.
 * No invitation email: many teachers share or rarely check one, and it
 * keeps the product working with no mail provider at all. The teacher must
 * choose their own password at first sign-in.
 */
export async function addTeacher(schoolId: string, name: string, email: string): Promise<TeamResult> {
  const school = await db().school.findUniqueOrThrow({ where: { id: schoolId }, select: { plan: true } });
  const active = await db().user.count({ where: { schoolId, isActive: true } });
  if (active >= limitsFor(school.plan).maxUsers) {
    return { ok: false, message: `Your plan includes ${limitsFor(school.plan).maxUsers} logins. Deactivate one to add another.` };
  }
  if (await db().user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, message: "That email already has an account." };
  }
  const tempPassword = generateTemporaryPassword();
  await db().user.create({
    data: { schoolId, name, email, role: "TEACHER", passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  return { ok: true, tempPassword };
}

export async function resetTeacherPassword(schoolId: string, userId: string): Promise<TeamResult> {
  const tempPassword = generateTemporaryPassword();
  const { count } = await db().user.updateMany({
    where: { id: userId, schoolId },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
  if (count !== 1) return { ok: false, message: "Teacher not found." };
  await db().session.deleteMany({ where: { userId } });
  return { ok: true, tempPassword };
}

/** Deactivating signs the teacher out everywhere. The last active admin cannot be deactivated. */
export async function setActive(schoolId: string, actingUserId: string, userId: string, isActive: boolean): Promise<TeamResult> {
  if (userId === actingUserId) return { ok: false, message: "You cannot deactivate yourself." };
  const target = await db().user.findFirst({ where: { id: userId, schoolId }, select: { role: true } });
  if (!target) return { ok: false, message: "Teacher not found." };
  if (isActive) {
    const school = await db().school.findUniqueOrThrow({ where: { id: schoolId }, select: { plan: true } });
    const active = await db().user.count({ where: { schoolId, isActive: true } });
    if (active >= limitsFor(school.plan).maxUsers) return { ok: false, message: "All logins on your plan are in use." };
  }
  await db().user.update({ where: { id: userId }, data: { isActive } });
  if (!isActive) await db().session.deleteMany({ where: { userId } });
  return { ok: true };
}

export async function setRole(schoolId: string, actingUserId: string, userId: string, role: "ADMIN" | "TEACHER"): Promise<TeamResult> {
  if (userId === actingUserId && role !== "ADMIN") {
    const admins = await db().user.count({ where: { schoolId, role: "ADMIN", isActive: true } });
    if (admins <= 1) return { ok: false, message: "A school needs at least one admin." };
  }
  const { count } = await db().user.updateMany({ where: { id: userId, schoolId }, data: { role } });
  return count === 1 ? { ok: true } : { ok: false, message: "Teacher not found." };
}
