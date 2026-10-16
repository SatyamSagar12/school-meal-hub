"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/server/auth/session";
import { logAudit } from "@/server/services/audit";
import { admissionNoTaken, createStudent, deleteStudent, exportStudents, importStudents, updateStudent } from "@/server/services/students";
import { saveQuickCounts, saveStudentMarks } from "@/server/services/attendance";
import { deleteExpense, saveExpense } from "@/server/services/expenses";
import { expenseSchema, isoDate, studentSchema } from "@/lib/schemas";
import { fail, ok, ErrorCode, type Result } from "@/lib/result";
import { todayISO } from "@/lib/mdm";

/**
 * Actions for the day-to-day register: students, attendance, expenses.
 * Each one re-checks the session, validates with the same schema the form
 * used, and scopes every write to the caller's school.
 */

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form.";

function notFuture(date: string): boolean {
  return date <= todayISO();
}

/* -------------------------------- students ------------------------------- */

export async function saveStudentAction(id: string | null, raw: unknown): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = studentSchema.safeParse(raw);
  if (!parsed.success) return fail(ErrorCode.VALIDATION, firstIssue(parsed.error));
  if (await admissionNoTaken(user.schoolId, parsed.data.admissionNo, id ?? undefined)) {
    return fail(ErrorCode.CONFLICT, "Another student already has that admission number.");
  }
  if (id) {
    if (!(await updateStudent(user.schoolId, id, parsed.data))) return fail(ErrorCode.NOT_FOUND, "Student not found.");
    await logAudit(user, "update", "student", id, { name: parsed.data.name });
  } else {
    const created = await createStudent(user.schoolId, user.id, parsed.data);
    await logAudit(user, "create", "student", created.id, { name: parsed.data.name });
  }
  revalidatePath("/students");
  return ok();
}

export async function deleteStudentAction(id: string): Promise<Result<null>> {
  const user = await requireAdmin();
  if (!(await deleteStudent(user.schoolId, id))) return fail(ErrorCode.NOT_FOUND, "Student not found.");
  await logAudit(user, "delete", "student", id);
  revalidatePath("/students");
  return ok();
}

/** Called by the browser in chunks of up to 100 rows, so each request stays small. */
export async function importStudentsAction(rows: unknown[]): Promise<Result<{ imported: number; skipped: number; errors: string[] }>> {
  const user = await requireUser();
  if (!Array.isArray(rows) || rows.length > 100) return fail(ErrorCode.VALIDATION, "Send at most 100 rows at a time.");
  const valid = [];
  const errors: string[] = [];
  for (const [i, row] of rows.entries()) {
    const parsed = studentSchema.safeParse(row);
    if (parsed.success) valid.push(parsed.data);
    else {
      const r = row as { __row?: number };
      errors.push(`Row ${r.__row ?? i + 2}: ${firstIssue(parsed.error)}`);
    }
  }
  const result = valid.length ? await importStudents(user.schoolId, user.id, valid) : { imported: 0, skipped: 0 };
  if (result.imported) await logAudit(user, "import", "student", null, { count: result.imported });
  revalidatePath("/students");
  return ok({ ...result, errors });
}

/* ------------------------------- attendance ------------------------------ */

const quickSchema = z.object({
  date: isoDate,
  counts: z
    .array(
      z.object({
        className: z.string().min(1).max(20),
        section: z.string().max(10),
        presentCount: z.number().int().min(0).max(10_000),
      }),
    )
    .max(200),
});

export async function saveQuickCountsAction(raw: unknown): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = quickSchema.safeParse(raw);
  if (!parsed.success) return fail(ErrorCode.VALIDATION, firstIssue(parsed.error));
  if (!notFuture(parsed.data.date)) return fail(ErrorCode.VALIDATION, "Attendance cannot be marked for a future date.");
  const result = await saveQuickCounts(user.schoolId, user.id, parsed.data.date, parsed.data.counts);
  if (!result.ok) return fail(ErrorCode.VALIDATION, result.message);
  await logAudit(user, "save", "class_attendance", null, {
    date: parsed.data.date,
    classes: result.saved,
    present: parsed.data.counts.reduce((a, c) => a + c.presentCount, 0),
  });
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return ok();
}

const marksSchema = z.object({
  date: isoDate,
  entries: z.array(z.object({ studentId: z.string().min(1).max(40), present: z.boolean() })).max(3000),
});

export async function saveStudentMarksAction(raw: unknown): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = marksSchema.safeParse(raw);
  if (!parsed.success) return fail(ErrorCode.VALIDATION, firstIssue(parsed.error));
  if (!notFuture(parsed.data.date)) return fail(ErrorCode.VALIDATION, "Attendance cannot be marked for a future date.");
  if (!parsed.data.entries.length) return fail(ErrorCode.VALIDATION, "There are no active students to mark.");
  await saveStudentMarks(user.schoolId, user.id, parsed.data.date, parsed.data.entries);
  await logAudit(user, "save", "attendance", null, {
    date: parsed.data.date,
    present: parsed.data.entries.filter((e) => e.present).length,
    absent: parsed.data.entries.filter((e) => !e.present).length,
  });
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return ok();
}

/* -------------------------------- expenses ------------------------------- */

export async function saveExpenseAction(raw: unknown): Promise<Result<{ totalExpense: number }>> {
  const user = await requireUser();
  const parsed = expenseSchema.safeParse(raw);
  if (!parsed.success) return fail(ErrorCode.VALIDATION, firstIssue(parsed.error));
  if (!notFuture(parsed.data.date)) return fail(ErrorCode.VALIDATION, "Expenses cannot be recorded for a future date.");
  const result = await saveExpense(user.schoolId, user.id, parsed.data.date, parsed.data);
  if (!result.ok) return fail(ErrorCode.VALIDATION, result.message);
  await logAudit(user, "save", "daily_expense", null, { date: parsed.data.date, total: result.totalExpense });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return ok({ totalExpense: result.totalExpense });
}

export async function deleteExpenseAction(date: string): Promise<Result<null>> {
  const user = await requireAdmin();
  if (!isoDate.safeParse(date).success) return fail(ErrorCode.VALIDATION, "Use a valid date.");
  if (!(await deleteExpense(user.schoolId, date))) return fail(ErrorCode.NOT_FOUND, "No expense record for that date.");
  await logAudit(user, "delete", "daily_expense", null, { date });
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return ok();
}

export async function exportStudentsAction(filters: {
  q: string;
  className: string;
  section: string;
  status: string;
}): Promise<Result<Record<string, string>[]>> {
  const user = await requireUser();
  const rows = await exportStudents(user.schoolId, {
    q: String(filters.q ?? "").slice(0, 100),
    className: String(filters.className ?? "").slice(0, 20),
    section: String(filters.section ?? "").slice(0, 10),
    status: String(filters.status ?? ""),
    page: 1,
  });
  return ok(
    rows.map((s) => ({
      admission_no: s.admissionNo,
      roll_no: s.rollNo ?? "",
      name: s.name,
      father_name: s.fatherName ?? "",
      mother_name: s.motherName ?? "",
      gender: s.gender.toLowerCase(),
      dob: s.dob ?? "",
      class: s.className,
      section: s.section,
      mobile: s.mobile ?? "",
      address: s.address ?? "",
      status: s.status.toLowerCase(),
    })),
  );
}
