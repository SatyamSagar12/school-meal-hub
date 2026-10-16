import Link from "next/link";
import { ClipboardCheck, IndianRupee } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { activeStudentCount } from "@/server/services/students";
import { dayTotalsFor, totalsRange } from "@/server/services/attendance";
import { expensesRange, getExpense } from "@/server/services/expenses";
import { getSchool, listClassRates } from "@/server/services/school";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Bars, ChartCard } from "@/components/app/bars";
import { Button } from "@/components/ui/button";
import { computeBudget, computeMealByTier, currentMonthISO, inr, monthRange, prettyDate, round3, todayISO, toRates } from "@/lib/mdm";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser();
  const { welcome } = await searchParams;
  const today = todayISO();
  const { start, end } = monthRange(currentMonthISO());

  const [school, overrides, students, day, todayExpense, monthExpenses, monthAttendance] = await Promise.all([
    getSchool(user.schoolId),
    listClassRates(user.schoolId),
    activeStudentCount(user.schoolId),
    dayTotalsFor(user.schoolId, today),
    getExpense(user.schoolId, today),
    expensesRange(user.schoolId, start, end),
    totalsRange(user.schoolId, start, end),
  ]);

  const rates = toRates(school);
  const meal = computeMealByTier(day.presentByClass, rates);
  const todayBudget = todayExpense?.budget ?? computeBudget(day.presentByClass, rates, overrides).totalBudget;
  const monthRice = monthExpenses.reduce((s, r) => s + r.riceKg, 0);
  const monthSpend = monthExpenses.reduce((s, r) => s + r.totalExpense, 0);
  const monthSaved = monthExpenses.reduce((s, r) => s + r.creditsSaved, 0);
  const upper = meal.byTier.upper_primary.present > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${prettyDate(today)} · Academic year ${school.academicYear}`}
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/attendance" />}>
              <ClipboardCheck /> Mark attendance
            </Button>
            <Button nativeButton={false} render={<Link href="/expenses" />}>
              <IndianRupee /> Record expenses
            </Button>
          </>
        }
      />

      {welcome && students === 0 ? (
        <div className="mb-6">
          <EmptyState
            title={`Welcome, ${user.name.split(" ")[0]}`}
            description="Start by adding your students — one by one or from an Excel sheet. Then check the meal norms in Settings, and you're ready to mark today's attendance."
            action={
              <Button nativeButton={false} render={<Link href="/students" />}>
                Add students
              </Button>
            }
          />
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Students" value={students} hint="Active enrolment" />
        <StatCard label="Present today" value={day.present} tone="success" hint={day.marked ? `${day.marked} classes marked` : "Not marked yet"} />
        <StatCard label="Absent today" value={day.absent} tone="danger" />
        <StatCard
          label="Rice today"
          value={`${meal.total.riceKg} kg`}
          tone="info"
          hint={upper ? `${meal.byTier.primary.riceKg} primary + ${meal.byTier.upper_primary.riceKg} upper` : `${meal.total.dalKg} kg dal · ${meal.total.vegKg} kg veg`}
        />
        <StatCard label="Today's expense" value={inr(todayExpense?.totalExpense ?? 0)} hint={todayExpense ? "Saved" : "Not recorded yet"} />
        <StatCard label="Today's budget" value={inr(todayBudget)} />
        <StatCard label="This month's spend" value={inr(monthSpend)} hint={`${monthExpenses.length} days recorded · ${round3(monthRice)} kg rice`} />
        <StatCard label="This month saved" value={inr(monthSaved)} tone={monthSaved >= 0 ? "success" : "danger"} hint="Budget minus spend" />
      </section>

      <section className="mt-4 grid gap-3 lg:grid-cols-2">
        <ChartCard title="Attendance" subtitle="Students present each day this month">
          <Bars data={monthAttendance.map((d) => ({ label: d.date.slice(8), value: d.present }))} color="var(--color-chart-2)" />
        </ChartCard>
        <ChartCard title="Spend against budget" subtitle="Daily cost (dark) inside the sanctioned budget (pale)">
          <Bars
            data={monthExpenses.map((r) => ({ label: r.date.slice(8), value: r.totalExpense, second: r.budget }))}
            color="var(--color-chart-1)"
            secondary="color-mix(in oklch, var(--color-chart-3) 45%, transparent)"
            format={inr}
          />
        </ChartCard>
      </section>
    </>
  );
}
