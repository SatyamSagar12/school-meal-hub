import "server-only";
import { d1, db } from "@/server/db";
import { newId, sqlDate } from "@/server/sql";
import { classKey, compareClasses, dayTotals, type ClassKey, type DayTotals } from "@/lib/mdm";
import { enrolment } from "@/server/services/students";

/**
 * Two ways to take attendance, as in the original app:
 *
 *  - Quick count: one number per class. What most schools actually do.
 *  - Student-wise: present/absent per child.
 *
 * Both may exist for the same day; a class's quick count wins over its
 * student-wise tally (resolvePresentByClass in lib/mdm.ts decides that).
 */

export async function studentRoster(schoolId: string, date: string, className: string) {
  const [students, marks] = await Promise.all([
    db().student.findMany({
      where: { schoolId, status: "ACTIVE", ...(className ? { className } : {}) },
      select: { id: true, name: true, rollNo: true, admissionNo: true, className: true, section: true },
      orderBy: [{ className: "asc" }, { section: "asc" }, { rollNo: "asc" }, { name: "asc" }],
    }),
    db().attendance.findMany({
      where: { schoolId, date, ...(className ? { className } : {}) },
      select: { studentId: true, present: true },
    }),
  ]);
  students.sort(compareClasses);
  const marked = new Map(marks.map((m) => [m.studentId, m.present]));
  return students.map((s) => ({ ...s, present: marked.get(s.id) ?? null }));
}

export type ClassRosterRow = {
  key: ClassKey;
  className: string;
  section: string;
  enrolled: number;
  /** Saved quick count for this date, or null. */
  quickCount: number | null;
  studentPresent: number;
  studentMarked: number;
};

export async function classRoster(schoolId: string, date: string): Promise<ClassRosterRow[]> {
  const [enrolled, marks, quick] = await Promise.all([
    enrolment(schoolId),
    db().attendance.groupBy({
      by: ["className", "section", "present"],
      where: { schoolId, date },
      _count: { _all: true },
    }),
    db().classAttendance.findMany({
      where: { schoolId, date },
      select: { className: true, section: true, presentCount: true },
    }),
  ]);

  const rows = new Map<ClassKey, ClassRosterRow>();
  const ensure = (className: string, section: string) => {
    const key = classKey(className, section);
    let row = rows.get(key);
    if (!row) {
      row = { key, className, section, enrolled: 0, quickCount: null, studentPresent: 0, studentMarked: 0 };
      rows.set(key, row);
    }
    return row;
  };
  for (const e of enrolled) ensure(e.className, e.section).enrolled = e.enrolled;
  for (const m of marks) {
    const row = ensure(m.className, m.section);
    row.studentMarked += m._count._all;
    if (m.present) row.studentPresent += m._count._all;
  }
  for (const q of quick) ensure(q.className, q.section).quickCount = q.presentCount;

  return [...rows.values()].sort(compareClasses);
}

/**
 * Saves per-student marks for one day.
 *
 * Written as INSERT ... SELECT from `students`, so the school scope and the
 * "active" check are in the statement itself: an id from another school, or
 * a student who has left, simply selects nothing. Students are chunked by id
 * (D1 allows 100 bound values per statement) and present and absent go in
 * separate statements, so a class of 300 is about four statements — well
 * inside the 50 queries a Worker may make per request on the free plan.
 * One D1 batch: the day is saved whole or not at all.
 */
const IDS_PER_STATEMENT = 90;

export async function saveStudentMarks(
  schoolId: string,
  userId: string,
  date: string,
  entries: { studentId: string; present: boolean }[],
): Promise<void> {
  const latest = new Map(entries.map((e) => [e.studentId, e.present]));
  const now = sqlDate();
  const statements: D1PreparedStatement[] = [];

  for (const present of [true, false]) {
    const ids = [...latest].filter(([, p]) => p === present).map(([id]) => id);
    for (let i = 0; i < ids.length; i += IDS_PER_STATEMENT) {
      const chunk = ids.slice(i, i + IDS_PER_STATEMENT);
      const placeholders = chunk.map((_, j) => `?${j + 6}`).join(", ");
      statements.push(
        d1()
          .prepare(
            `INSERT INTO attendance (id, schoolId, date, studentId, className, section, present, markedById, createdAt, updatedAt)
             SELECT lower(hex(randomblob(16))), s.schoolId, ?2, s.id, s.className, s.section, ?3, ?4, ?5, ?5
               FROM students s
              WHERE s.schoolId = ?1 AND s.status = 'ACTIVE' AND s.id IN (${placeholders})
             ON CONFLICT (studentId, date) DO UPDATE SET
               present = excluded.present, className = excluded.className, section = excluded.section,
               markedById = excluded.markedById, updatedAt = excluded.updatedAt`,
          )
          .bind(schoolId, date, present ? 1 : 0, userId, now, ...chunk),
      );
    }
  }
  if (statements.length) await d1().batch(statements);
}

export type QuickCountResult = { ok: true; saved: number } | { ok: false; message: string };

/**
 * Saves class head counts. The enrolled figure is taken from the register
 * here, never from the form, and a count above it is refused.
 */
export async function saveQuickCounts(
  schoolId: string,
  userId: string,
  date: string,
  counts: { className: string; section: string; presentCount: number }[],
): Promise<QuickCountResult> {
  const enrolled = new Map((await enrolment(schoolId)).map((e) => [classKey(e.className, e.section), e.enrolled]));
  for (const c of counts) {
    const max = enrolled.get(classKey(c.className, c.section));
    if (max === undefined) return { ok: false, message: `Class ${c.className}-${c.section} has no active students.` };
    if (c.presentCount > max) {
      return { ok: false, message: `Class ${c.className}-${c.section}: present (${c.presentCount}) cannot exceed enrolled (${max}).` };
    }
  }
  if (!counts.length) return { ok: false, message: "Enter a present count for at least one class." };

  const now = sqlDate();
  await d1().batch(
    counts.map((c) =>
      d1()
        .prepare(
          `INSERT INTO class_attendance (id, schoolId, date, className, section, presentCount, enrolledCount, markedById, createdAt, updatedAt)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
           ON CONFLICT (schoolId, date, className, section) DO UPDATE SET
             presentCount = excluded.presentCount, enrolledCount = excluded.enrolledCount,
             markedById = excluded.markedById, updatedAt = excluded.updatedAt`,
        )
        .bind(newId(), schoolId, date, c.className, c.section, c.presentCount, enrolled.get(classKey(c.className, c.section))!, userId, now),
    ),
  );
  return { ok: true, saved: counts.length };
}

/** The day's effective totals from both modes. */
export async function dayTotalsFor(schoolId: string, date: string): Promise<DayTotals> {
  const [marks, quick] = await Promise.all([
    db().attendance.findMany({ where: { schoolId, date }, select: { className: true, section: true, present: true } }),
    db().classAttendance.findMany({
      where: { schoolId, date },
      select: { className: true, section: true, presentCount: true, enrolledCount: true },
    }),
  ]);
  return dayTotals(marks, quick);
}

/**
 * Per-day present/absent over a range, merging both modes. Grouped in SQL
 * for student-wise marks so a month reads a few hundred rows, not one per
 * child per day.
 */
export async function totalsRange(schoolId: string, start: string, end: string) {
  const [marks, quick] = await Promise.all([
    db().attendance.groupBy({
      by: ["date", "className", "section", "present"],
      where: { schoolId, date: { gte: start, lte: end } },
      _count: { _all: true },
    }),
    db().classAttendance.findMany({
      where: { schoolId, date: { gte: start, lte: end } },
      select: { date: true, className: true, section: true, presentCount: true, enrolledCount: true },
    }),
  ]);

  const days = new Map<string, { marks: { className: string; section: string; present: boolean }[]; quick: typeof quick }>();
  const day = (date: string) => {
    let d = days.get(date);
    if (!d) {
      d = { marks: [], quick: [] };
      days.set(date, d);
    }
    return d;
  };
  for (const m of marks) {
    const list = day(m.date).marks;
    for (let i = 0; i < m._count._all; i++) list.push({ className: m.className, section: m.section, present: m.present });
  }
  for (const q of quick) day(q.date).quick.push(q);

  return [...days.entries()]
    .map(([date, d]) => {
      const t = dayTotals(d.marks, d.quick);
      return { date, present: t.present, absent: t.absent };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
