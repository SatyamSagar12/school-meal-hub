import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { monthRange, type DailyExpense, type Settings, type Student } from "./mdm";

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

export const dayStatsQuery = (date: string) =>
  queryOptions({
    queryKey: ["attendance", "day", date],
    queryFn: async () => {
      const rows = unwrap(
        await supabase
          .from("attendance")
          .select("status, class_name, section")
          .eq("attendance_date", date),
      ) as { status: string; class_name: string; section: string }[];
      const present = rows.filter((r) => r.status === "present").length;
      return { present, absent: rows.length - present, marked: rows.length, rows };
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
