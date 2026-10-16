"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportExcel, exportPdf } from "@/lib/export";
import { inr, prettyDate, REPORT_SCOPE_LABEL, REPORT_SCOPES, round2, round3, scopeExpenseRow, type ReportScope, type SavedExpense } from "@/lib/mdm";
import { cn } from "@/lib/utils";

type Mode = "daily" | "monthly" | "custom";

const SCOPE_SLUG: Record<ReportScope, string> = { combined: "combined", primary: "primary", upper_primary: "upper-primary" };

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="bg-muted inline-flex flex-wrap rounded-lg p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-md px-3 py-1.5 text-sm font-medium", value === o.value ? "bg-card shadow-xs" : "text-muted-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ReportsClient(props: {
  mode: Mode;
  month: string;
  day: string;
  from: string;
  to: string;
  today: string;
  range: { start: string; end: string };
  school: { name: string; udiseCode: string | null };
  expenses: SavedExpense[];
  attendance: { date: string; present: number; absent: number }[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<ReportScope>("combined");
  const { mode, range, expenses } = props;

  function go(params: Record<string, string>) {
    const sp = new URLSearchParams({ mode, month: props.month, day: props.day, from: props.from, to: props.to, ...params });
    router.push(`/reports?${sp.toString()}`);
  }

  const scoped = expenses.map((r) => scopeExpenseRow(r, scope));
  const totals = scoped.reduce(
    (a, r) => ({
      present: a.present + r.present,
      rice: a.rice + r.riceKg,
      dal: a.dal + r.dalKg,
      veg: a.veg + r.vegKg,
      expense: a.expense + r.totalExpense,
      budget: a.budget + r.budget,
      saved: a.saved + r.creditsSaved,
    }),
    { present: 0, rice: 0, dal: 0, veg: 0, expense: 0, budget: 0, saved: 0 },
  );
  const presentUpper = expenses.reduce((a, r) => a + r.presentUpper, 0);
  const presentPrimary = expenses.reduce((a, r) => a + r.presentCount - r.presentUpper, 0);
  const att = props.attendance.reduce((a, r) => ({ p: a.p + r.present, ab: a.ab + r.absent }), { p: 0, ab: 0 });
  const attendancePct = att.p + att.ab > 0 ? Math.round((att.p / (att.p + att.ab)) * 1000) / 10 : 0;

  const scopeLabel = REPORT_SCOPE_LABEL[scope];
  const periodLabel = mode === "daily" ? prettyDate(range.start) : `${prettyDate(range.start)} – ${prettyDate(range.end)}`;
  const fileName = `mdm-report-${SCOPE_SLUG[scope]}-${range.start}-to-${range.end}`;
  const showTiers = scope === "combined" && presentUpper > 0;

  const columns = [
    "Date",
    "Present",
    ...(showTiers ? ["Present (LP)", "Present (UP)"] : []),
    "Rice (kg)",
    "Dal (kg)",
    "Veg (kg)",
    ...(showTiers ? ["Rice LP (kg)", "Rice UP (kg)"] : []),
    "Dal ₹",
    "Veg ₹",
    "Masala ₹",
    "Fuel ₹",
    "Other ₹",
    "Total ₹",
    "Budget ₹",
    "Saved ₹",
  ];
  const rows = scoped.map((s, i) => {
    const r = expenses[i];
    return [
      s.date,
      s.present,
      ...(showTiers ? [r.presentCount - r.presentUpper, r.presentUpper] : []),
      round3(s.riceKg),
      round3(s.dalKg),
      round3(s.vegKg),
      ...(showTiers ? [round3(r.riceKg - r.riceKgUpper), round3(r.riceKgUpper)] : []),
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

  async function excel() {
    if (!rows.length) return toast.error("There is no data in this period to export.");
    await exportExcel(
      rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))),
      fileName,
      `${scopeLabel} report`,
    );
  }

  async function pdf() {
    if (!rows.length) return toast.error("There is no data in this period to export.");
    await exportPdf({
      title: props.school.name,
      subtitle: `Mid-day meal report · ${scopeLabel} · ${periodLabel}${props.school.udiseCode ? ` · UDISE ${props.school.udiseCode}` : ""}`,
      columns,
      rows,
      fileName,
      landscape: true,
      summary: [
        scope === "combined" ? `Meals served: ${totals.present}    Attendance: ${attendancePct}%` : `${scopeLabel} meals served: ${totals.present}`,
        ...(showTiers ? [`Primary (1-5): ${presentPrimary} meals    Upper primary (6-8): ${presentUpper} meals`] : []),
        `Rice: ${round3(totals.rice)} kg    Dal: ${round3(totals.dal)} kg    Vegetables: ${round3(totals.veg)} kg`,
        `Spent: ${inr(round2(totals.expense))}    Budget: ${inr(round2(totals.budget))}    Saved: ${inr(round2(totals.saved))}`,
        ...(scope === "combined" ? [] : ["Dal and vegetable costs apportioned by this tier's share of quantity; masala, fuel, other and budget by its share of attendance."]),
      ],
    });
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description={scope === "combined" ? periodLabel : `${scopeLabel} · ${periodLabel}`}
        actions={
          <>
            <Button variant="outline" onClick={excel}>
              <Download /> Excel
            </Button>
            <Button onClick={pdf}>
              <FileText /> PDF
            </Button>
          </>
        }
      />

      <div className="bg-card mb-4 grid gap-3 rounded-xl border p-4" data-noprint>
        <Segmented
          value={mode}
          onChange={(m) => go({ mode: m })}
          options={[
            { value: "daily", label: "Daily" },
            { value: "monthly", label: "Monthly" },
            { value: "custom", label: "Custom range" },
          ]}
        />
        <Segmented value={scope} onChange={setScope} options={REPORT_SCOPES.map((s) => ({ value: s, label: REPORT_SCOPE_LABEL[s] }))} />
        <div className="flex flex-wrap gap-3">
          {mode === "daily" ? (
            <Input type="date" aria-label="Date" className="w-44" value={props.day} max={props.today} onChange={(e) => e.target.value && go({ day: e.target.value })} />
          ) : mode === "monthly" ? (
            <Input type="month" aria-label="Month" className="w-44" value={props.month} onChange={(e) => e.target.value && go({ month: e.target.value })} />
          ) : (
            <>
              <Input type="date" aria-label="From" className="w-44" value={props.from} max={props.to} onChange={(e) => e.target.value && go({ from: e.target.value })} />
              <Input type="date" aria-label="To" className="w-44" value={props.to} min={props.from} max={props.today} onChange={(e) => e.target.value && go({ to: e.target.value })} />
            </>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Meals served"
          value={totals.present}
          hint={scope === "combined" ? `${attendancePct}% attendance` : `of ${presentPrimary + presentUpper} school-wide`}
        />
        <StatCard label="Rice used" value={`${round3(totals.rice)} kg`} tone="info" />
        <StatCard label="Spent" value={inr(round2(totals.expense))} hint={`Budget ${inr(round2(totals.budget))}`} />
        <StatCard label="Saved" value={inr(round2(totals.saved))} tone={totals.saved >= 0 ? "success" : "danger"} />
      </section>

      <div className="bg-card mt-4 overflow-x-auto rounded-xl border">
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-muted-foreground py-10 text-center">
                  No expense records in this period.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((r) => (
              <TableRow key={String(r[0])}>
                {r.map((cell, i) => (
                  <TableCell key={i} className={i === 0 ? "font-medium whitespace-nowrap" : "text-right"}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {scope !== "combined" && rows.length ? (
        <p className="text-muted-foreground mt-3 text-xs">
          Quantities are exact per tier. Rupee figures are apportioned so the two tier reports add back up to the combined one.
        </p>
      ) : null}
    </>
  );
}
