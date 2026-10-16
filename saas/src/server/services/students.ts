import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import type { StudentInput } from "@/lib/schemas";
import { compareClasses } from "@/lib/mdm";

export type StudentFilters = {
  q: string;
  className: string;
  section: string;
  status: string;
  page: number;
};

export const PAGE_SIZE = 25;

function whereFor(schoolId: string, f: StudentFilters): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = { schoolId };
  // SQLite LIKE is case-insensitive for ASCII, which covers names and numbers.
  const q = f.q.trim();
  if (q) where.OR = [{ name: { contains: q } }, { admissionNo: { contains: q } }, { rollNo: { contains: q } }];
  if (f.className) where.className = f.className;
  if (f.section) where.section = f.section;
  if (f.status === "ACTIVE" || f.status === "INACTIVE" || f.status === "TRANSFERRED") where.status = f.status;
  return where;
}

export async function listStudents(schoolId: string, f: StudentFilters) {
  const where = whereFor(schoolId, f);
  const [rows, total] = await Promise.all([
    db().student.findMany({
      where,
      orderBy: [{ className: "asc" }, { section: "asc" }, { rollNo: "asc" }, { name: "asc" }],
      skip: (Math.max(1, f.page) - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db().student.count({ where }),
  ]);
  return { rows, total };
}

/** Every student matching the filters, for an Excel export. */
export async function exportStudents(schoolId: string, f: StudentFilters) {
  return db().student.findMany({
    where: whereFor(schoolId, f),
    orderBy: [{ className: "asc" }, { section: "asc" }, { rollNo: "asc" }, { name: "asc" }],
  });
}

/** Classes and sections that have active students. */
export async function classList(schoolId: string): Promise<{ classes: string[]; sections: string[] }> {
  const rows = await db().student.groupBy({
    by: ["className", "section"],
    where: { schoolId, status: "ACTIVE" },
  });
  const classes = [...new Set(rows.map((r) => r.className))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sections = [...new Set(rows.map((r) => r.section))].sort();
  return { classes, sections };
}

/** Active enrolment per class/section. */
export async function enrolment(schoolId: string) {
  const rows = await db().student.groupBy({
    by: ["className", "section"],
    where: { schoolId, status: "ACTIVE" },
    _count: { _all: true },
  });
  return rows.map((r) => ({ className: r.className, section: r.section, enrolled: r._count._all })).sort(compareClasses);
}

export async function activeStudentCount(schoolId: string): Promise<number> {
  return db().student.count({ where: { schoolId, status: "ACTIVE" } });
}

export async function admissionNoTaken(schoolId: string, admissionNo: string, exceptId?: string): Promise<boolean> {
  const found = await db().student.findUnique({
    where: { schoolId_admissionNo: { schoolId, admissionNo } },
    select: { id: true },
  });
  return Boolean(found && found.id !== exceptId);
}

export async function createStudent(schoolId: string, userId: string, data: StudentInput) {
  return db().student.create({ data: { ...data, schoolId, createdById: userId }, select: { id: true } });
}

/** Scoped by school in the where: an id from another school matches nothing. */
export async function updateStudent(schoolId: string, id: string, data: StudentInput): Promise<boolean> {
  const { count } = await db().student.updateMany({ where: { id, schoolId }, data });
  return count === 1;
}

export async function deleteStudent(schoolId: string, id: string): Promise<boolean> {
  const { count } = await db().student.deleteMany({ where: { id, schoolId } });
  return count === 1;
}

/**
 * Bulk import. Rows whose admission number already exists in this school
 * are skipped, not overwritten: an import never silently edits a record.
 */
export async function importStudents(schoolId: string, userId: string, rows: StudentInput[]) {
  const existing = new Set(
    (
      await db().student.findMany({ where: { schoolId }, select: { admissionNo: true } })
    ).map((s) => s.admissionNo),
  );
  const fresh: StudentInput[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const row of rows) {
    if (existing.has(row.admissionNo) || seen.has(row.admissionNo)) {
      skipped += 1;
      continue;
    }
    seen.add(row.admissionNo);
    fresh.push(row);
  }
  if (fresh.length) {
    await db().student.createMany({ data: fresh.map((r) => ({ ...r, schoolId, createdById: userId })) });
  }
  return { imported: fresh.length, skipped };
}
