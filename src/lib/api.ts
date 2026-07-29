import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import {
  classKey,
  monthRange,
  resolvePresentByClass,
  type ClassKey,
  type ClassRate,
  type DailyExpense,
  type Settings,
  type Student,
} from "./mdm";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/* ------------------------------- settings ------------------------------- */

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["settings"],
    staleTime: 60_000,
    queryFn: async (): Promise<Settings> =>
      unwrap(await supabase.from("settings").select("*").eq("id", true).maybeSingle()),
  });

export async function updateSettings(values: TablesUpdate<"settings">) {
  const { error } = await supabase.from("settings").update(values).eq("id", true);
  if (error) throw new Error(error.message);
}

/* ------------------------------ class rates ----------------------------- */

export const classRatesQuery = () =>
  queryOptions({
    queryKey: ["classRates"],
    staleTime: 60_000,
    queryFn: async (): Promise<ClassRate[]> =>
      unwrap(await supabase.from("class_rates").select("*").order("class_name").order("section")),
  });

/** Set a per-class budget override. `section` '' applies to the whole class. */
export async function upsertClassRate(
  className: string,
  section: string,
  budgetPerStudent: number,
) {
  const { error } = await supabase.from("class_rates").upsert(
    {
      class_name: className,
      section,
      budget_per_student: budgetPerStudent,
    },
    { onConflict: "class_name,section" },
  );
  if (error) throw new Error(error.message);
}

/** Remove an override so the class falls back to the school-wide rate. */
export async function deleteClassRate(className: string, section: string) {
  const { error } = await supabase
    .from("class_rates")
    .delete()
    .eq("class_name", className)
    .eq("section", section);
  if (error) throw new Error(error.message);
}

/* -------------------------------- profile ------------------------------- */

export const meQuery = () =>
  queryOptions({
    queryKey: ["me"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        id: user.id,
        email: user.email ?? "",
        fullName: profile?.full_name || user.user_metadata?.full_name || "",
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      };
    },
  });

/* -------------------------------- students ------------------------------ */

export interface StudentFilters {
  search: string;
  classFilter: string;
  sectionFilter: string;
  statusFilter: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortAsc: boolean;
}

export const studentsQuery = (f: StudentFilters) =>
  queryOptions({
    queryKey: ["students", f],
    queryFn: async () => {
      let q = supabase.from("students").select("*", { count: "exact" });
      if (f.search.trim()) {
        const s = f.search.trim().replace(/[%,()]/g, "");
        q = q.or(`name.ilike.%${s}%,admission_no.ilike.%${s}%,roll_no.ilike.%${s}%`);
      }
      if (f.classFilter !== "all") q = q.eq("class_name", f.classFilter);
      if (f.sectionFilter !== "all") q = q.eq("section", f.sectionFilter);
      if (f.statusFilter !== "all")
        q = q.eq("status", f.statusFilter as "active" | "inactive" | "transferred");
      q = q.order(f.sortBy, { ascending: f.sortAsc });
      const from = (f.page - 1) * f.pageSize;
      const { data, error, count } = await q.range(from, from + f.pageSize - 1);
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as Student[], total: count ?? 0 };
    },
  });

export const allStudentsQuery = () =>
  queryOptions({
    queryKey: ["students", "all"],
    queryFn: async (): Promise<Student[]> =>
      unwrap(
        await supabase
          .from("students")
          .select("*")
          .order("class_name")
          .order("section")
          .order("roll_no", { nullsFirst: false }),
      ),
  });

export const classListQuery = () =>
  queryOptions({
    queryKey: ["classes"],
    staleTime: 60_000,
    queryFn: async () => {
      const rows = unwrap(
        await supabase.from("students").select("class_name, section").eq("status", "active"),
      ) as { class_name: string; section: string }[];
      const classes = [...new Set(rows.map((r) => r.class_name))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      );
      const sections = [...new Set(rows.map((r) => r.section))].sort();
      return { classes, sections };
    },
  });

export async function createStudent(payload: TablesInsert<"students">) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("students")
    .insert({ ...payload, created_by: auth.user?.id ?? null });
  if (error) throw new Error(error.message);
}

export async function updateStudent(id: string, payload: TablesUpdate<"students">) {
  const { error } = await supabase.from("students").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteStudent(id: string) {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function bulkInsertStudents(rows: TablesInsert<"students">[]) {
  const { data: auth } = await supabase.auth.getUser();
  const withOwner = rows.map((r) => ({ ...r, created_by: auth.user?.id ?? null }));
  const { error } = await supabase.from("students").insert(withOwner);
  if (error) throw new Error(error.message);
}

/* ------------------------------- attendance ----------------------------- */

export const attendanceRosterQuery = (date: string, className: string, section: string) =>
  queryOptions({
    queryKey: ["attendance", "roster", date, className, section],
    queryFn: async () => {
      let sq = supabase.from("students").select("*").eq("status", "active");
      if (className !== "all") sq = sq.eq("class_name", className);
      if (section !== "all") sq = sq.eq("section", section);
      const students = unwrap(
        await sq.order("class_name").order("section").order("roll_no", { nullsFirst: false }),
      ) as Student[];

      const marked = unwrap(
        await supabase.from("attendance").select("*").eq("attendance_date", date),
      ) as { student_id: string; status: "present" | "absent" }[];

      const map = new Map(marked.map((m) => [m.student_id, m.status]));
      return {
        students,
        existing: map,
        alreadySaved: students.length > 0 && students.every((s) => map.has(s.id)),
      };
    },
  });

export async function saveAttendance(
  date: string,
  entries: { student: Student; status: "present" | "absent" }[],
) {
  const { data: auth } = await supabase.auth.getUser();
  const payload: TablesInsert<"attendance">[] = entries.map((e) => ({
    attendance_date: date,
    student_id: e.student.id,
    class_name: e.student.class_name,
    section: e.student.section,
    status: e.status,
    marked_by: auth.user?.id ?? null,
  }));
  const { error } = await supabase
    .from("attendance")
    .upsert(payload, { onConflict: "attendance_date,student_id" });
  if (error) throw new Error(error.message);
}

/* --------------------- class-wise quick attendance ---------------------- */

export interface ClassRosterRow {
  key: ClassKey;
  className: string;
  section: string;
  enrolled: number;
  /** Saved quick count for this date, or null if none. */
  quickCount: number | null;
  /** Present tally from individually marked students on this date. */
  studentPresent: number;
  studentMarked: number;
}

/**
 * Per-class view of a date: how many are enrolled, any saved quick count, and
 * the per-student tally — everything the quick-count screen needs.
 */
export const classRosterQuery = (date: string) =>
  queryOptions({
    queryKey: ["attendance", "classRoster", date],
    queryFn: async (): Promise<ClassRosterRow[]> => {
      const [students, marked, quick] = await Promise.all([
        supabase.from("students").select("class_name, section").eq("status", "active"),
        supabase
          .from("attendance")
          .select("status, class_name, section")
          .eq("attendance_date", date),
        supabase
          .from("class_attendance")
          .select("class_name, section, present_count")
          .eq("attendance_date", date),
      ]);

      const studentRows = unwrap(students) as { class_name: string; section: string }[];
      const markedRows = unwrap(marked) as {
        status: string;
        class_name: string;
        section: string;
      }[];
      const quickRows = unwrap(quick) as {
        class_name: string;
        section: string;
        present_count: number;
      }[];

      const rows = new Map<ClassKey, ClassRosterRow>();
      const ensure = (className: string, section: string) => {
        const key = classKey(className, section);
        let row = rows.get(key);
        if (!row) {
          row = {
            key,
            className,
            section,
            enrolled: 0,
            quickCount: null,
            studentPresent: 0,
            studentMarked: 0,
          };
          rows.set(key, row);
        }
        return row;
      };

      for (const s of studentRows) ensure(s.class_name, s.section).enrolled += 1;
      for (const m of markedRows) {
        const row = ensure(m.class_name, m.section);
        row.studentMarked += 1;
        if (m.status === "present") row.studentPresent += 1;
      }
      for (const q of quickRows) {
        ensure(q.class_name, q.section).quickCount = Number(q.present_count);
      }

      return [...rows.values()].sort(
        (a, b) =>
          a.className.localeCompare(b.className, undefined, { numeric: true }) ||
          a.section.localeCompare(b.section),
      );
    },
  });

export async function saveClassAttendance(
  date: string,
  rows: { className: string; section: string; presentCount: number; enrolledCount: number }[],
) {
  for (const r of rows) {
    if (r.presentCount > r.enrolledCount) {
      throw new Error(
        `Class ${r.className}-${r.section}: present (${r.presentCount}) cannot exceed enrolled (${r.enrolledCount})`,
      );
    }
  }
  const { data: auth } = await supabase.auth.getUser();
  const payload: TablesInsert<"class_attendance">[] = rows.map((r) => ({
    attendance_date: date,
    class_name: r.className,
    section: r.section,
    present_count: r.presentCount,
    enrolled_count: r.enrolledCount,
    marked_by: auth.user?.id ?? null,
  }));
  const { error } = await supabase
    .from("class_attendance")
    .upsert(payload, { onConflict: "attendance_date,class_name,section" });
  if (error) throw new Error(error.message);
}

/**
 * Day totals across both marking modes. `present` is the effective count after
 * quick counts override per-student tallies for the same class.
 */
export const dayStatsQuery = (date: string) =>
  queryOptions({
    queryKey: ["attendance", "day", date],
    queryFn: async () => {
      const [marked, quick] = await Promise.all([
        supabase
          .from("attendance")
          .select("status, class_name, section")
          .eq("attendance_date", date),
        supabase
          .from("class_attendance")
          .select("class_name, section, present_count, enrolled_count")
          .eq("attendance_date", date),
      ]);

      const rows = unwrap(marked) as { status: string; class_name: string; section: string }[];
      const quickRows = unwrap(quick) as {
        class_name: string;
        section: string;
        present_count: number;
        enrolled_count: number;
      }[];

      const studentTally = new Map<ClassKey, number>();
      const studentTotal = new Map<ClassKey, number>();
      for (const r of rows) {
        const key = classKey(r.class_name, r.section);
        studentTotal.set(key, (studentTotal.get(key) ?? 0) + 1);
        if (r.status === "present") studentTally.set(key, (studentTally.get(key) ?? 0) + 1);
      }
      // Classes marked per-student with nobody present still count as marked.
      for (const key of studentTotal.keys()) {
        if (!studentTally.has(key)) studentTally.set(key, 0);
      }

      const quickCounts = new Map<ClassKey, number>();
      const quickEnrolled = new Map<ClassKey, number>();
      for (const q of quickRows) {
        const key = classKey(q.class_name, q.section);
        quickCounts.set(key, Number(q.present_count));
        quickEnrolled.set(key, Number(q.enrolled_count));
      }

      const presentByClass = resolvePresentByClass(quickCounts, studentTally);
      const present = [...presentByClass.values()].reduce((a, b) => a + b, 0);

      // Absent is only meaningful where we know the denominator.
      let absent = 0;
      for (const [key, count] of presentByClass) {
        const enrolled = quickCounts.has(key) ? quickEnrolled.get(key) : studentTotal.get(key);
        if (enrolled !== undefined) absent += Math.max(0, enrolled - count);
      }

      return {
        present,
        absent,
        marked: presentByClass.size,
        presentByClass,
        rows,
        quickRows,
      };
    },
  });

export const attendanceRangeQuery = (start: string, end: string) =>
  queryOptions({
    queryKey: ["attendance", "range", start, end],
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from("attendance")
          .select("attendance_date, status, class_name, section, student_id")
          .gte("attendance_date", start)
          .lte("attendance_date", end)
          .order("attendance_date"),
      ) as {
        attendance_date: string;
        status: string;
        class_name: string;
        section: string;
        student_id: string;
      }[];
      return rows;
    },
  });

export interface DailyAttendanceTotals {
  date: string;
  present: number;
  absent: number;
}

/**
 * Per-day present/absent totals over a range, merging quick counts with
 * per-student rows. Use this rather than `attendanceRangeQuery` wherever a
 * count is needed — the raw per-student rows alone under-report any day that
 * was marked by class-wise quick count.
 */
export const attendanceTotalsRangeQuery = (start: string, end: string) =>
  queryOptions({
    queryKey: ["attendance", "totals", start, end],
    queryFn: async (): Promise<DailyAttendanceTotals[]> => {
      const [marked, quick] = await Promise.all([
        supabase
          .from("attendance")
          .select("attendance_date, status, class_name, section")
          .gte("attendance_date", start)
          .lte("attendance_date", end),
        supabase
          .from("class_attendance")
          .select("attendance_date, class_name, section, present_count, enrolled_count")
          .gte("attendance_date", start)
          .lte("attendance_date", end),
      ]);

      const markedRows = unwrap(marked) as {
        attendance_date: string;
        status: string;
        class_name: string;
        section: string;
      }[];
      const quickRows = unwrap(quick) as {
        attendance_date: string;
        class_name: string;
        section: string;
        present_count: number;
        enrolled_count: number;
      }[];

      // date -> class key -> tallies, so each day resolves independently.
      const byDate = new Map<
        string,
        {
          studentTally: Map<ClassKey, number>;
          studentTotal: Map<ClassKey, number>;
          quickCounts: Map<ClassKey, number>;
          quickEnrolled: Map<ClassKey, number>;
        }
      >();
      const ensureDay = (date: string) => {
        let day = byDate.get(date);
        if (!day) {
          day = {
            studentTally: new Map(),
            studentTotal: new Map(),
            quickCounts: new Map(),
            quickEnrolled: new Map(),
          };
          byDate.set(date, day);
        }
        return day;
      };

      for (const r of markedRows) {
        const day = ensureDay(r.attendance_date);
        const key = classKey(r.class_name, r.section);
        day.studentTotal.set(key, (day.studentTotal.get(key) ?? 0) + 1);
        day.studentTally.set(
          key,
          (day.studentTally.get(key) ?? 0) + (r.status === "present" ? 1 : 0),
        );
      }
      for (const q of quickRows) {
        const day = ensureDay(q.attendance_date);
        const key = classKey(q.class_name, q.section);
        day.quickCounts.set(key, Number(q.present_count));
        day.quickEnrolled.set(key, Number(q.enrolled_count));
      }

      return [...byDate.entries()]
        .map(([date, day]) => {
          const presentByClass = resolvePresentByClass(day.quickCounts, day.studentTally);
          let present = 0;
          let absent = 0;
          for (const [key, count] of presentByClass) {
            present += count;
            const enrolled = day.quickCounts.has(key)
              ? day.quickEnrolled.get(key)
              : day.studentTotal.get(key);
            if (enrolled !== undefined) absent += Math.max(0, enrolled - count);
          }
          return { date, present, absent };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });

/* -------------------------------- expenses ------------------------------ */

export const expenseByDateQuery = (date: string) =>
  queryOptions({
    queryKey: ["expense", date],
    queryFn: async (): Promise<DailyExpense | null> => {
      const { data, error } = await supabase
        .from("daily_expenses")
        .select("*")
        .eq("expense_date", date)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const expensesRangeQuery = (start: string, end: string) =>
  queryOptions({
    queryKey: ["expenses", start, end],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("daily_expenses")
          .select("*")
          .gte("expense_date", start)
          .lte("expense_date", end)
          .order("expense_date"),
      ),
  });

export const expensesMonthQuery = (monthISO: string) => {
  const { start, end } = monthRange(monthISO);
  return expensesRangeQuery(start, end);
};

export async function saveExpense(payload: TablesInsert<"daily_expenses">) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("daily_expenses")
    .upsert({ ...payload, created_by: auth.user?.id ?? null }, { onConflict: "expense_date" });
  if (error) throw new Error(error.message);
}

export async function deleteExpense(date: string) {
  const { error } = await supabase.from("daily_expenses").delete().eq("expense_date", date);
  if (error) throw new Error(error.message);
}

/* -------------------------------- audit --------------------------------- */

export async function logAudit(
  action: string,
  entity: string,
  entityId?: string,
  details?: object,
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("audit_logs").insert({
    user_id: auth.user.id,
    action,
    entity,
    entity_id: entityId ?? null,
    details: (details ?? null) as never,
  });
}

export const auditQuery = () =>
  queryOptions({
    queryKey: ["audit"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
      ),
  });
