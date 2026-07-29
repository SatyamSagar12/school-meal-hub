import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { attendanceTotalsRangeQuery, expensesRangeQuery, settingsQuery } from "@/lib/api";
import { exportExcel, exportPdf } from "@/lib/export";
import { currentMonthISO, inr, monthRange, num, prettyDate, round3, todayISO } from "@/lib/mdm";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Mid-Day Meal Manager" },
      {
        name: "description",
        content:
          "Generate daily, monthly and custom-range mid-day meal reports and export them to Excel or PDF.",
      },
      { property: "og:title", content: "Reports — Mid-Day Meal Manager" },
      {
        property: "og:description",
        content: "Attendance, consumption and expenditure reports with one-click export.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

type Mode = "daily" | "monthly" | "custom";

function ReportsPage() {
  const [mode, setMode] = useState<Mode>("monthly");
  const [day, setDay] = useState(todayISO());
  const [month, setMonth] = useState(currentMonthISO());
  const [from, setFrom] = useState(monthRange(currentMonthISO()).start);
  const [to, setTo] = useState(todayISO());

  const range =
    mode === "daily"
      ? { start: day, end: day }
      : mode === "monthly"
        ? monthRange(month)
        : { start: from, end: to };

  const { data: settings } = useQuery(settingsQuery());
  const { data: expenses, isLoading } = useQuery(expensesRangeQuery(range.start, range.end));
  const { data: attendance } = useQuery(attendanceTotalsRangeQuery(range.start, range.end));

  const rows = expenses ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      present: acc.present + num(r.present_count),
      rice: acc.rice + num(r.rice_kg),
      dal: acc.dal + num(r.dal_kg),
      veg: acc.veg + num(r.veg_kg),
      expense: acc.expense + num(r.total_expense),
      budget: acc.budget + num(r.budget),
      credits: acc.credits + num(r.credits_saved),
    }),
    { present: 0, rice: 0, dal: 0, veg: 0, expense: 0, budget: 0, credits: 0 },
  );

  // Merged per-day totals, so quick-count days are included in the percentage.
  const attendanceTotals = (attendance ?? []).reduce(
    (acc, r) => {
      acc.present += r.present;
      acc.absent += r.absent;
      return acc;
    },
    { present: 0, absent: 0 },
  );
  const attendancePct =
    attendanceTotals.present + attendanceTotals.absent > 0
      ? Math.round(
          (attendanceTotals.present / (attendanceTotals.present + attendanceTotals.absent)) * 1000,
        ) / 10
      : 0;

  const label =
    mode === "daily" ? prettyDate(day) : `${prettyDate(range.start)} – ${prettyDate(range.end)}`;
  const fileName = `mdm-report-${range.start}-to-${range.end}`;

  const columns = [
    "Date",
    "Present",
    "Rice (kg)",
    "Dal (kg)",
    "Veg (kg)",
    "Dal ₹",
    "Veg ₹",
    "Masala ₹",
    "Fuel ₹",
    "Other ₹",
    "Total ₹",
    "Budget ₹",
    "Credits ₹",
  ];

  const tableRows = rows.map((r) => [
    r.expense_date,
    num(r.present_count),
    round3(num(r.rice_kg)),
    round3(num(r.dal_kg)),
    round3(num(r.veg_kg)),
    num(r.dal_cost),
    num(r.veg_cost),
    num(r.masala_cost),
    num(r.fuel_cost),
    num(r.misc_cost),
    num(r.total_expense),
    num(r.budget),
    num(r.credits_saved),
  ]);

  function handleExcel() {
    if (!rows.length) return toast.error("There is no data in this range to export");
    exportExcel(
      tableRows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))),
      fileName,
      "MDM Report",
    );
    toast.success("Excel report downloaded");
  }

  function handlePdf() {
    if (!rows.length) return toast.error("There is no data in this range to export");
    exportPdf({
      title: settings?.school_name ?? "Mid-Day Meal Report",
      subtitle: `Mid-day meal report · ${label}`,
      columns,
      rows: tableRows,
      fileName,
      landscape: true,
      summary: [
        `Total present meals: ${totals.present}    Attendance: ${attendancePct}%`,
        `Rice: ${round3(totals.rice)} kg    Dal: ${round3(totals.dal)} kg    Vegetables: ${round3(totals.veg)} kg`,
        `Expenditure: ${inr(totals.expense)}    Budget: ${inr(totals.budget)}    Credits saved: ${inr(totals.credits)}`,
      ],
    });
    toast.success("PDF report downloaded");
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description={label}
        actions={
          <>
            <Button variant="outline" onClick={handleExcel}>
              <Download className="mr-1.5 size-4" /> Excel
            </Button>
            <Button onClick={handlePdf}>
              <FileText className="mr-1.5 size-4" /> PDF
            </Button>
          </>
        }
      />

      <Card className="mb-4 gap-3 p-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="custom">Custom range</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "daily" && (
          <div className="max-w-xs">
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="r-day">
              Date
            </label>
            <Input
              id="r-day"
              type="date"
              max={todayISO()}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
        )}

        {mode === "monthly" && (
          <div className="max-w-xs">
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="r-month"
            >
              Month
            </label>
            <Input
              id="r-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        )}

        {mode === "custom" && (
          <div className="grid max-w-lg gap-3 sm:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-xs font-medium text-muted-foreground"
                htmlFor="r-from"
              >
                From
              </label>
              <Input
                id="r-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-medium text-muted-foreground"
                htmlFor="r-to"
              >
                To
              </label>
              <Input
                id="r-to"
                type="date"
                value={to}
                min={from}
                max={todayISO()}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        )}
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Meals served"
          value={totals.present}
          hint={`${attendancePct}% attendance`}
          loading={isLoading}
        />
        <StatCard
          label="Rice consumed"
          value={`${round3(totals.rice)} kg`}
          tone="info"
          loading={isLoading}
        />
        <StatCard
          label="Total expenditure"
          value={inr(totals.expense)}
          loading={isLoading}
          hint={`Budget ${inr(totals.budget)}`}
        />
        <StatCard
          label="Credits saved"
          value={inr(totals.credits)}
          tone={totals.credits >= 0 ? "success" : "danger"}
          loading={isLoading}
        />
      </section>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c} className={c === "Date" ? "" : "text-right"}>
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={columns.length}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && !tableRows.length && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No expenditure records in this period.
                  </TableCell>
                </TableRow>
              )}
              {tableRows.map((r) => (
                <TableRow key={String(r[0])}>
                  {r.map((cell, i) => (
                    <TableCell
                      key={i}
                      className={i === 0 ? "font-medium" : "text-right tabular-nums"}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
