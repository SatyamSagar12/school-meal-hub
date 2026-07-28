import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ClipboardCheck,
  IndianRupee,
  PiggyBank,
  UserCheck,
  UserX,
  Users,
  Wheat,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  attendanceRangeQuery,
  dayStatsQuery,
  expenseByDateQuery,
  expensesMonthQuery,
  settingsQuery,
  studentsQuery,
} from "@/lib/api";
import { computeMeal, currentMonthISO, inr, monthRange, num, prettyDate, todayISO, toRates } from "@/lib/mdm";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Mid-Day Meal Manager" },
      {
        name: "description",
        content:
          "Today's attendance, rice and meal quantities, expenditure, budget and credits saved at a glance.",
      },
      { property: "og:title", content: "Dashboard — Mid-Day Meal Manager" },
      { property: "og:description", content: "Live attendance, meal and budget figures for your school." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

const chartAxis = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

function ChartCard({
  title,
  subtitle,
  children,
  loading,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <Card className="gap-1 p-4 shadow-card">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-2 text-xs text-muted-foreground">{subtitle}</p>
      <div className="h-56 w-full">
        {loading ? <Skeleton className="size-full" /> : <ResponsiveContainer width="100%" height="100%">{children as never}</ResponsiveContainer>}
      </div>
    </Card>
  );
}

function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--color-popover)",
      border: "1px solid var(--color-border)",
      borderRadius: "12px",
      color: "var(--color-popover-foreground)",
      fontSize: "12px",
    },
  };
}

function Dashboard() {
  const today = todayISO();
  const month = currentMonthISO();
  const { start, end } = monthRange(month);

  const { data: settings } = useQuery(settingsQuery());
  const { data: studentPage, isLoading: loadingStudents } = useQuery(
    studentsQuery({
      search: "",
      classFilter: "all",
      sectionFilter: "all",
      statusFilter: "active",
      page: 1,
      pageSize: 1,
      sortBy: "name",
      sortAsc: true,
    }),
  );
  const { data: day, isLoading: loadingDay } = useQuery(dayStatsQuery(today));
  const { data: todayExpense } = useQuery(expenseByDateQuery(today));
  const { data: monthExpenses, isLoading: loadingMonth } = useQuery(expensesMonthQuery(month));
  const { data: monthAttendance, isLoading: loadingTrend } = useQuery(attendanceRangeQuery(start, end));

  const rates = toRates(settings);
  const present = day?.present ?? 0;
  const meal = computeMeal(present, rates);
  const totalStudents = studentPage?.total ?? 0;

  const monthlyRice = (monthExpenses ?? []).reduce((s, r) => s + num(r.rice_kg), 0);
  const monthlyExpense = (monthExpenses ?? []).reduce((s, r) => s + num(r.total_expense), 0);
  const monthlyCredits = (monthExpenses ?? []).reduce((s, r) => s + num(r.credits_saved), 0);

  const trend = Object.values(
    (monthAttendance ?? []).reduce<Record<string, { date: string; present: number; absent: number }>>(
      (acc, r) => {
        const key = r.attendance_date;
        acc[key] ??= { date: key.slice(8), present: 0, absent: 0 };
        if (r.status === "present") acc[key].present += 1;
        else acc[key].absent += 1;
        return acc;
      },
      {},
    ),
  );

  const expenseSeries = (monthExpenses ?? []).map((r) => ({
    date: r.expense_date.slice(8),
    expense: num(r.total_expense),
    budget: num(r.budget),
    rice: num(r.rice_kg),
    credits: num(r.credits_saved),
  }));

  const todayBudget = num(todayExpense?.budget) || present * rates.budget_per_student;
  const todayTotal = num(todayExpense?.total_expense);
  const todayCredits = todayExpense ? num(todayExpense.credits_saved) : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${prettyDate(today)} · Academic year ${settings?.academic_year ?? "—"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/attendance">
                <ClipboardCheck className="mr-1.5 size-4" /> Mark attendance
              </Link>
            </Button>
            <Button asChild>
              <Link to="/expenses">
                <IndianRupee className="mr-1.5 size-4" /> Record expenses
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total students" value={totalStudents} icon={Users} loading={loadingStudents} hint="Active enrolment" />
        <StatCard label="Present today" value={present} icon={UserCheck} tone="success" loading={loadingDay} hint={day?.marked ? `${day.marked} marked` : "Not marked yet"} />
        <StatCard label="Absent today" value={day?.absent ?? 0} icon={UserX} tone="danger" loading={loadingDay} />
        <StatCard label="Today's rice" value={`${meal.riceKg} kg`} icon={Wheat} tone="info" loading={loadingDay} hint={`${meal.riceG} g total`} />
      </section>

      <section className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's expense" value={inr(todayTotal)} icon={IndianRupee} hint={todayExpense ? "Saved" : "Not recorded yet"} />
        <StatCard label="Today's budget" value={inr(todayBudget)} icon={CalendarDays} hint={`₹${rates.budget_per_student} × ${present}`} />
        <StatCard
          label="Today's credits saved"
          value={inr(todayCredits)}
          icon={PiggyBank}
          tone={todayCredits >= 0 ? "success" : "danger"}
        />
        <StatCard label="Monthly rice used" value={`${Math.round(monthlyRice * 1000) / 1000} kg`} icon={Wheat} tone="info" loading={loadingMonth} />
      </section>

      <section className="mt-3 grid gap-3 sm:grid-cols-2">
        <StatCard label="Monthly expense" value={inr(monthlyExpense)} icon={IndianRupee} loading={loadingMonth} hint={`${monthExpenses?.length ?? 0} days recorded`} />
        <StatCard
          label="Monthly credits saved"
          value={inr(monthlyCredits)}
          icon={PiggyBank}
          tone={monthlyCredits >= 0 ? "success" : "danger"}
          loading={loadingMonth}
        />
      </section>

      <section className="mt-4 grid gap-3 lg:grid-cols-2">
        <ChartCard title="Attendance trend" subtitle="Present vs absent this month" loading={loadingTrend}>
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" {...chartAxis} />
            <YAxis {...chartAxis} width={34} />
            <Tooltip {...tooltipStyle()} />
            <Area type="monotone" dataKey="present" stroke="var(--color-chart-1)" fill="url(#gPresent)" strokeWidth={2} />
            <Area type="monotone" dataKey="absent" stroke="var(--color-destructive)" fill="transparent" strokeWidth={2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Monthly expenses" subtitle="Daily spend against sanctioned budget" loading={loadingMonth}>
          <BarChart data={expenseSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" {...chartAxis} />
            <YAxis {...chartAxis} width={44} />
            <Tooltip {...tooltipStyle()} />
            <Bar dataKey="budget" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Rice consumption" subtitle="Kilograms issued per day" loading={loadingMonth}>
          <LineChart data={expenseSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" {...chartAxis} />
            <YAxis {...chartAxis} width={38} />
            <Tooltip {...tooltipStyle()} />
            <Line type="monotone" dataKey="rice" stroke="var(--color-chart-4)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Credits saved" subtitle="Budget minus actual expenditure" loading={loadingMonth}>
          <BarChart data={expenseSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="date" {...chartAxis} />
            <YAxis {...chartAxis} width={44} />
            <Tooltip {...tooltipStyle()} />
            <Bar dataKey="credits" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </section>
    </>
  );
}
