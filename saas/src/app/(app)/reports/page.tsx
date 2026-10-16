import { requireUser } from "@/server/auth/session";
import { totalsRange } from "@/server/services/attendance";
import { expensesRange } from "@/server/services/expenses";
import { getSchool } from "@/server/services/school";
import { currentMonthISO, isIsoDate, ISO_MONTH, monthRange, todayISO } from "@/lib/mdm";
import { ReportsClient } from "./reports-client";

export const metadata = { title: "Reports" };

type Mode = "daily" | "monthly" | "custom";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const mode: Mode = sp.mode === "daily" || sp.mode === "custom" ? sp.mode : "monthly";
  const month = sp.month && ISO_MONTH.test(sp.month) ? sp.month : currentMonthISO();
  const day = isIsoDate(sp.day) ? sp.day : today;
  let from = isIsoDate(sp.from) ? sp.from : monthRange(currentMonthISO()).start;
  let to = isIsoDate(sp.to) ? sp.to : today;
  if (from > to) [from, to] = [to, from];

  const range = mode === "daily" ? { start: day, end: day } : mode === "monthly" ? monthRange(month) : { start: from, end: to };
  const [school, expenses, attendance] = await Promise.all([
    getSchool(user.schoolId),
    expensesRange(user.schoolId, range.start, range.end),
    totalsRange(user.schoolId, range.start, range.end),
  ]);

  return (
    <ReportsClient
      mode={mode}
      month={month}
      day={day}
      from={from}
      to={to}
      today={today}
      range={range}
      school={{ name: school.name, udiseCode: school.udiseCode }}
      expenses={expenses.map(({ date, presentCount, presentUpper, riceKg, dalKg, vegKg, riceKgUpper, dalKgUpper, vegKgUpper, dalCost, vegCost, masalaCost, fuelCost, miscCost, totalExpense, budget, creditsSaved }) => ({
        date, presentCount, presentUpper, riceKg, dalKg, vegKg, riceKgUpper, dalKgUpper, vegKgUpper, dalCost, vegCost, masalaCost, fuelCost, miscCost, totalExpense, budget, creditsSaved,
      }))}
      attendance={attendance}
    />
  );
}
