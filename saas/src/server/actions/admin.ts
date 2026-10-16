"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUserEvenIfLocked, getSession } from "@/server/auth/session";
import { logAudit } from "@/server/services/audit";
import { setClassRate, updateSchool } from "@/server/services/school";
import { addTeacher, resetTeacherPassword, setActive, setRole } from "@/server/services/team";
import { startPhonePeCheckout, submitManualUpi } from "@/server/services/payments";
import { applyPayment, markPaymentFailed } from "@/server/services/billing";
import { extendSchool, setSuspended } from "@/server/services/platform";
import { emailSchema, nameSchema, schoolSettingsSchema } from "@/lib/schemas";
import { fail, ok, ErrorCode, type Result } from "@/lib/result";
import { claimAttempt } from "@/lib/rate-limit";

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form.";

/* -------------------------------- settings ------------------------------- */

export async function updateSchoolAction(raw: unknown): Promise<Result<null>> {
  const user = await requireAdmin();
  const parsed = schoolSettingsSchema.safeParse(raw);
  if (!parsed.success) return fail(ErrorCode.VALIDATION, firstIssue(parsed.error));
  await updateSchool(user.schoolId, parsed.data);
  await logAudit(user, "update", "school_settings");
  revalidatePath("/", "layout");
  return ok();
}

const classRateSchema = z.object({
  className: z.string().trim().min(1).max(20),
  section: z.string().trim().max(10),
  budgetPerStudent: z.number().min(0).max(1000).nullable(),
});

export async function setClassRateAction(raw: unknown): Promise<Result<null>> {
  const user = await requireAdmin();
  const parsed = classRateSchema.safeParse(raw);
  if (!parsed.success) return fail(ErrorCode.VALIDATION, firstIssue(parsed.error));
  await setClassRate(user.schoolId, parsed.data.className, parsed.data.section, parsed.data.budgetPerStudent);
  await logAudit(user, "update", "class_rate", null, parsed.data);
  revalidatePath("/settings");
  return ok();
}

/* ---------------------------------- team --------------------------------- */

export async function addTeacherAction(raw: unknown): Promise<Result<{ tempPassword: string }>> {
  const user = await requireAdmin();
  const parsed = z.object({ name: nameSchema, email: emailSchema }).safeParse(raw);
  if (!parsed.success) return fail(ErrorCode.VALIDATION, firstIssue(parsed.error));
  const result = await addTeacher(user.schoolId, parsed.data.name, parsed.data.email);
  if (!result.ok) return fail(ErrorCode.CONFLICT, result.message);
  await logAudit(user, "create", "user", null, { email: parsed.data.email });
  revalidatePath("/settings");
  return ok({ tempPassword: result.tempPassword! });
}

export async function resetTeacherPasswordAction(userId: string): Promise<Result<{ tempPassword: string }>> {
  const user = await requireAdmin();
  const result = await resetTeacherPassword(user.schoolId, userId);
  if (!result.ok) return fail(ErrorCode.NOT_FOUND, result.message);
  await logAudit(user, "reset_password", "user", userId);
  revalidatePath("/settings");
  return ok({ tempPassword: result.tempPassword! });
}

export async function setTeacherActiveAction(userId: string, isActive: boolean): Promise<Result<null>> {
  const user = await requireAdmin();
  const result = await setActive(user.schoolId, user.id, userId, isActive);
  if (!result.ok) return fail(ErrorCode.VALIDATION, result.message);
  await logAudit(user, isActive ? "activate" : "deactivate", "user", userId);
  revalidatePath("/settings");
  return ok();
}

export async function setTeacherRoleAction(userId: string, role: "ADMIN" | "TEACHER"): Promise<Result<null>> {
  const user = await requireAdmin();
  if (role !== "ADMIN" && role !== "TEACHER") return fail(ErrorCode.VALIDATION, "Unknown role.");
  const result = await setRole(user.schoolId, user.id, userId, role);
  if (!result.ok) return fail(ErrorCode.VALIDATION, result.message);
  await logAudit(user, "set_role", "user", userId, { role });
  revalidatePath("/settings");
  return ok();
}

/* --------------------------------- billing ------------------------------- */

/** Any teacher can pay; schools often have the in-charge teacher, not the admin, hold the UPI app. */
export async function payOnlineAction(): Promise<void> {
  const user = await requireUserEvenIfLocked();
  const result = await startPhonePeCheckout(user.schoolId, user.id);
  if (!result.ok) redirect(`/billing?error=${encodeURIComponent(result.error)}`);
  redirect(result.redirectUrl);
}

export async function submitUpiAction(utr: string): Promise<Result<null>> {
  const user = await requireUserEvenIfLocked();
  if (!(await claimAttempt(`upi:${user.schoolId}`, 10, 60 * 60 * 1000))) return fail(ErrorCode.RATE_LIMITED, "Too many attempts. Try again in an hour.");
  const result = await submitManualUpi(user.schoolId, user.id, String(utr ?? "").replace(/\s/g, ""));
  if (!result.ok) return fail(ErrorCode.VALIDATION, result.error);
  await logAudit(user, "submit", "upi_payment");
  revalidatePath("/billing");
  return ok();
}

/* -------------------------------- platform ------------------------------- */

async function requirePlatformAdmin() {
  const user = await getSession();
  if (!user?.isPlatformAdmin) redirect("/dashboard");
  return user;
}

export async function confirmUpiAction(paymentId: string): Promise<Result<null>> {
  const admin = await requirePlatformAdmin();
  if (!(await applyPayment(paymentId, null, `Confirmed by ${admin.email}`))) return fail(ErrorCode.CONFLICT, "That payment is no longer waiting.");
  revalidatePath("/platform");
  return ok();
}

export async function rejectUpiAction(paymentId: string): Promise<Result<null>> {
  const admin = await requirePlatformAdmin();
  await markPaymentFailed(paymentId, "FAILED", `Not received; rejected by ${admin.email}`);
  revalidatePath("/platform");
  return ok();
}

export async function extendSchoolAction(schoolId: string, days: number): Promise<Result<null>> {
  await requirePlatformAdmin();
  if (!Number.isInteger(days) || days < 1 || days > 400) return fail(ErrorCode.VALIDATION, "Days must be 1 to 400.");
  await extendSchool(schoolId, days);
  revalidatePath("/platform");
  return ok();
}

export async function setSuspendedAction(schoolId: string, suspended: boolean): Promise<Result<null>> {
  await requirePlatformAdmin();
  await setSuspended(schoolId, suspended, suspended ? "Suspended by the operator" : null);
  revalidatePath("/platform");
  return ok();
}
