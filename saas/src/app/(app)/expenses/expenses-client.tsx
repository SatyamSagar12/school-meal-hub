"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { deleteExpenseAction, saveExpenseAction } from "@/server/actions/register";
import { classLabel, computeBudget, computeExpense, inr, kg, prettyDate, TIER_LABEL, TIERS, type ClassRateOverride, type MealRates } from "@/lib/mdm";

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 text-sm ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function ExpensesClient(props: {
  date: string;
  today: string;
  isAdmin: boolean;
  marked: boolean;
  presentByClass: [string, number][];
  existing: { dalRate: number; vegRate: number; miscCost: number; miscNote: string | null } | null;
  rates: MealRates;
  overrides: ClassRateOverride[];
}) {
  const { date, existing, rates, overrides } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    dalRate: String(existing?.dalRate ?? ""),
    vegRate: String(existing?.vegRate ?? ""),
    miscCost: String(existing?.miscCost ?? ""),
    miscNote: existing?.miscNote ?? "",
  });

  const presentByClass = useMemo(() => new Map(props.presentByClass), [props.presentByClass]);
  // The same function the server runs when saving, so the preview is the saved figure.
  const calc = computeExpense(
    presentByClass,
    rates,
    { dalRate: Number(form.dalRate) || 0, vegRate: Number(form.vegRate) || 0, miscCost: Number(form.miscCost) || 0 },
    overrides,
  );

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const result = await saveExpenseAction({ date, ...form });
      if (result.ok) {
        toast.success(`Expenses saved for ${prettyDate(date)}`);
        router.refresh();
      } else toast.error(result.error.message);
    });
  }

  function remove() {
    if (!confirm(`Delete the expense record for ${prettyDate(date)}?`)) return;
    start(async () => {
      const result = await deleteExpenseAction(date);
      if (result.ok) {
        toast.success("Expense record deleted");
        router.refresh();
      } else toast.error(result.error.message);
    });
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <>
      <PageHeader
        title="Daily expenses"
        description={`${prettyDate(date)} · ${calc.present} students present`}
        actions={
          props.isAdmin && existing ? (
            <Button variant="outline" onClick={remove} disabled={pending}>
              <Trash2 /> Delete record
            </Button>
          ) : null
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Rice issued" value={kg(calc.riceKg)} tone="info" hint="Free government supply" />
        <StatCard label="Total expense" value={inr(calc.totalExpense)} />
        <StatCard label="Budget" value={inr(calc.budget)} />
        <StatCard label="Saved" value={inr(calc.creditsSaved)} tone={calc.creditsSaved >= 0 ? "success" : "danger"} hint={calc.creditsSaved < 0 ? "Over budget" : "Within budget"} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <form onSubmit={save} className="bg-card rounded-xl border p-5">
          <h2 className="text-sm font-semibold">Cost entry</h2>
          <p className="text-muted-foreground mb-4 text-xs">Quantities come from the attendance count. Only prices and extra costs need entry.</p>
          <label className="mb-4 grid gap-1 text-xs font-medium">
            <span className="text-muted-foreground">Date</span>
            <Input type="date" value={date} max={props.today} onChange={(e) => e.target.value && router.push(`/expenses?date=${e.target.value}`)} className="w-44" />
            {!props.marked ? <span className="text-destructive">Attendance has not been marked for this date yet.</span> : null}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium">
              Dal price (₹ per kg)
              <Input type="number" inputMode="decimal" step="0.01" min="0" {...field("dalRate")} />
              <span className="text-muted-foreground text-xs font-normal">{kg(calc.dalKg)} needed</span>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Vegetable price (₹ per kg)
              <Input type="number" inputMode="decimal" step="0.01" min="0" {...field("vegRate")} />
              <span className="text-muted-foreground text-xs font-normal">{kg(calc.vegKg)} needed</span>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Other cost (₹)
              <Input type="number" inputMode="decimal" step="0.01" min="0" {...field("miscCost")} />
              <span className="text-muted-foreground text-xs font-normal">Eggs, fruit, milk…</span>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Note
              <Textarea rows={2} placeholder="What was the extra cost for?" {...field("miscNote")} />
            </label>
          </div>
          <Button type="submit" className="mt-5" disabled={pending || !props.marked}>
            <Save /> {pending ? "Saving…" : existing ? "Update expenses" : "Save expenses"}
          </Button>
        </form>

        <div className="bg-card rounded-xl border p-5">
          <h2 className="text-sm font-semibold">Worked out for you</h2>
          <p className="text-muted-foreground mb-3 text-xs">{calc.present} students, each class at its own tier&apos;s norms.</p>
          {TIERS.filter((t) => calc.byTier[t].present > 0).map((t) => (
            <div key={t} className="bg-muted/50 mb-2 rounded-lg px-3 py-2 text-xs">
              <p className="mb-0.5 font-medium">
                {TIER_LABEL[t]} — {calc.byTier[t].present} present
              </p>
              <p className="text-muted-foreground">
                {rates[t].ricePerStudentG} g rice, {rates[t].dalPerStudentG} g dal, {rates[t].vegPerStudentG} g veg each · {kg(calc.byTier[t].riceKg)} rice
              </p>
            </div>
          ))}
          <Line label="Rice (no cost)" value={kg(calc.riceKg)} />
          <Line label={`Dal — ${kg(calc.dalKg)}`} value={inr(calc.dalCost)} />
          <Line label={`Vegetables — ${kg(calc.vegKg)}`} value={inr(calc.vegCost)} />
          <Line label="Masala" value={inr(calc.masalaCost)} />
          <Line label="Fuel" value={inr(calc.fuelCost)} />
          <Line label="Other" value={inr(calc.miscCost)} />
          <Separator className="my-2" />
          <Line label="Total spent" value={inr(calc.totalExpense)} strong />
          <Line label="Sanctioned budget" value={inr(calc.budget)} strong />
          {overrides.length > 0 || props.presentByClass.length > 1 ? (
            <details className="text-muted-foreground mt-1 text-xs">
              <summary className="cursor-pointer py-1">Budget by class</summary>
              {computeBudget(presentByClass, rates, overrides).perClass.map((c) => (
                    <div key={c.key} className="flex justify-between py-0.5">
                      <span>
                        {classLabel(c.className, c.section)} — {c.present} × {inr(c.rate)}
                      </span>
                      <span className="tabular-nums">{inr(c.budget)}</span>
                    </div>
                  ))}
            </details>
          ) : null}
          <div className="bg-muted mt-3 flex items-center justify-between rounded-xl px-3 py-2.5">
            <span className="text-sm font-semibold">Saved today</span>
            <span className={`text-lg font-bold tabular-nums ${calc.creditsSaved >= 0 ? "text-success" : "text-destructive"}`}>{inr(calc.creditsSaved)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
