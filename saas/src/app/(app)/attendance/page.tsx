import { requireUser } from "@/server/auth/session";
import { classRoster, studentRoster } from "@/server/services/attendance";
import { classList } from "@/server/services/students";
import { mealContext } from "@/server/services/school";
import { isIsoDate, todayISO } from "@/lib/mdm";
import { AttendanceClient } from "./attendance-client";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string; class?: string; mode?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const date = isIsoDate(sp.date) && sp.date <= today ? sp.date : today;
  const mode = sp.mode === "student" ? "student" : "quick";
  const className = typeof sp.class === "string" ? sp.class.slice(0, 20) : "";

  const [classes, roster, students, ctx] = await Promise.all([
    classList(user.schoolId),
    classRoster(user.schoolId, date),
    // The per-student list is only loaded for the mode that shows it.
    mode === "student" ? studentRoster(user.schoolId, date, className) : Promise.resolve([]),
    mealContext(user.schoolId),
  ]);

  return (
    <AttendanceClient
      key={`${date}|${mode}|${className}`}
      date={date}
      today={today}
      mode={mode}
      className={className}
      classes={classes.classes}
      roster={roster}
      students={students}
      rates={ctx.rates}
      overrides={ctx.overrides}
    />
  );
}
