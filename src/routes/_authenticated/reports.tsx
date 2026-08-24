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
import type { ReportScope } from "@/lib/mdm";
import {
  REPORT_SCOPE_LABEL,
  currentMonthISO,
  inr,
  monthRange,
  num,
  prettyDate,
  round2,
  round3,
  scopeExpenseRow,
  todayISO,
} from "@/lib/mdm";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Mid-Day Meal Manager" },
      {
        name: "description",
        content:
          "Generate daily, monthly and custom-range mid-day meal reports for primary, upper primary or the whole school, and export them to Excel or PDF.",
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

const SCOPES: ReportScope[] = ["combined", "primary", "upper_primary"];

/** Filename-safe suffix so the three scopes never overwrite each other. */
const SCOPE_SLUG: Record<ReportScope, string> = {
  combined: "combined",
  primary: "primary",
  upper_primary: "upper-primary",
};

function ReportsPage() {
  const [mode, setMode] = useState<Mode>("monthly");
  const [scope, setScope] = useState<ReportScope>("combined");
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

  // Every figure below reads the scoped view, so switching scope re-reports the
  // same days as primary-only, upper-primary-only or the whole school.
  const scoped = rows.map((r) => scopeExpenseRow(r, scope));

  const totals = scoped.reduce(
    (acc, r) => ({
      present: acc.present + r.present,
      rice: acc.rice + r.riceKg,
      dal: acc.dal + r.dalKg,
      veg: acc.veg + r.vegKg,
      expense: acc.expense + r.totalExpense,
      budget: acc.budget + r.budget,
      credits: acc.credits + r.creditsSaved,
    }),
    { present: 0, rice: 0, dal: 0, veg: 0, expense: 0, budget: 0, credits: 0 },
  );

  // The combined report keeps its per-tier columns; those split totals come from
  // the saved rows rather than the scoped view, which has already collapsed them.
  const tierTotals = rows.reduce(
    (acc, r) => ({
      presentPrimary: acc.presentPrimary + (num(r.present_count) - num(r.present_upper)),
      presentUpper: acc.presentUpper + num(r.present_upper),
    }),
    { presentPrimary: 0, presentUpper: 0 },
  );

  // Rows saved before tiering carry no split; they were all costed at what is
  // now the primary rate, so the upper columns are legitimately zero.
  const hasUpperPrimary = tierTotals.presentUpper > 0;

  // Merged per-day totals, so quick-count days are included in the percentage.
  // Attendance is recorded school-wide, so the percentage stays a whole-school
  // figure and is shown only on the combined report.
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

  const scopeLabel = REPORT_SCOPE_LABEL[scope];
  const periodLabel =
    mode === "daily" ? prettyDate(day) : `${prettyDate(range.start)} – ${prettyDate(range.end)}`;
  const label = scope === "combined" ? periodLabel : `${scopeLabel} · ${periodLabel}`;
  const fileName = `mdm-report-${SCOPE_SLUG[scope]}-${range.start}-to-${range.end}`;

  // The tier columns only earn their width on the combined report of a school
  // that actually has upper primary classes; a scoped report is already one
  // tier, so repeating the split there would be noise.
  const showTierColumns = scope === "combined" && hasUpperPrimary;

  const columns = [
    "Date",
    "Present",
    ...(showTierColumns ? ["Present (LP)", "Present (UP)"] : []),
    "Rice (kg)",
    "Dal (kg)",
    "Veg (kg)",
    ...(showTierColumns
      ? ["Rice LP (kg)", "Dal LP (kg)", "Veg LP (kg)", "Rice UP (kg)", "Dal UP (kg)", "Veg UP (kg)"]
      : []),
    "Dal ₹",
    "Veg ₹",
    "Masala ₹",
    "Fuel ₹",
    "Other ₹",
    "Total ₹",
    "Budget ₹",
    "Credits ₹",
  ];

  const tableRows = scoped.map((s, i) => {
    const r = rows[i];
    // Lower primary is whatever the day's grand total is not upper primary.
    const lpPresent = num(r.present_count) - num(r.present_upper);
    const lpRice = num(r.rice_kg) - num(r.rice_kg_upper);
    const lpDal = num(r.dal_kg) - num(r.dal_kg_upper);
    const lpVeg = num(r.veg_kg) - num(r.veg_kg_upper);
    return [
      s.date,
      s.present,
      ...(showTierColumns ? [lpPresent, num(r.present_upper)] : []),
      round3(s.riceKg),
      round3(s.dalKg),
      round3(s.vegKg),
      ...(showTierColumns
        ? [
            round3(lpRice),
            round3(lpDal),
            round3(lpVeg),
            round3(num(r.rice_kg_upper)),
            round3(num(r.dal_kg_upper)),
            round3(num(r.veg_kg_upper)),
          ]
        : []),
      s.dalCost,
      s.vegCost,
      s.masalaCost,
      s.fuelCost,
      s.miscCost,
      s.totalExpense,
      s.budget,
      s.creditsSaved,
    ];
  });

  function handleExcel() {
    if (!tableRows.length) return toast.error("There is no data in this range to export");
    exportExcel(
      tableRows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))),
      fileName,
      `${scopeLabel} report`,
    );
    toast.success(`${scopeLabel} Excel report downloaded`);
  }

  function handlePdf() {
    if (!tableRows.length) return toast.error("There is no data in this range to export");
    exportPdf({
      title: settings?.school_name ?? "Mid-Day Meal Report",
      subtitle: `Mid-day meal report · ${scopeLabel} · ${periodLabel}`,
      columns,
      rows: tableRows,
      fileName,
      landscape: true,
      summary: [
        scope === "combined"
          ? `Total present meals: ${totals.present}    Attendance: ${attendancePct}%`
          : `${scopeLabel} meals served: ${totals.present}`,
        ...(showTierColumns
          ? [
              `Primary (1-5): ${tierTotals.presentPrimary} meals    Upper primary (6-8): ${tierTotals.presentUpper} meals`,
            ]
          : []),
        `Rice: ${round3(totals.rice)} kg    Dal: ${round3(totals.dal)} kg    Vegetables: ${round3(totals.veg)} kg`,
        `Expenditure: ${inr(round2(totals.expense))}    Budget: ${inr(round2(totals.budget))}    Credits saved: ${inr(round2(totals.credits))}`,
        ...(scope === "combined"
          ? []
          : [
              "Note: dal and vegetable costs are apportioned by this tier's share of the day's quantity; masala, fuel, other and budget by its share of attendance.",
            ]),
      ],
    });
    toast.success(`${scopeLabel} PDF report downloaded`);
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

        <div>
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Report for</span>
          <Tabs value={scope} onValueChange={(v) => setScope(v as ReportScope)}>
            <TabsList>
              {SCOPES.map((s) => (
                <TabsTrigger key={s} value={s}>
                  {REPORT_SCOPE_LABEL[s]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

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
          label={scope === "combined" ? "Meals served" : `Meals served · ${scopeLabel}`}
          value={totals.present}
          hint={
            scope === "combined"
              ? `${attendancePct}% attendance`
              : `of ${tierTotals.presentPrimary + tierTotals.presentUpper} school-wide`
          }
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
          value={inr(round2(totals.expense))}
          loading={isLoading}
          hint={`Budget ${inr(round2(totals.budget))}`}
        />
        <StatCard
          label="Credits saved"
          value={inr(round2(totals.credits))}
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

      {scope !== "combined" && !isLoading && !!tableRows.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          Quantities are exact per tier. Dal and vegetable costs are apportioned by this tier&apos;s
          share of the day&apos;s quantity; masala, fuel, other and budget by its share of
          attendance — so the two tier reports add back up to the combined one.
        </p>
      )}
    </>
  );
}
