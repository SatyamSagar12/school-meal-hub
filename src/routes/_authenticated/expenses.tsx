import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { IndianRupee, PiggyBank, Save, Trash2, Wheat } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  classRatesQuery,
  dayStatsQuery,
  deleteExpense,
  expenseByDateQuery,
  logAudit,
  meQuery,
  saveExpense,
  settingsQuery,
} from "@/lib/api";
import {
  classLabel,
  computeBudget,
  computeExpense,
  inr,
  kg,
  num,
  prettyDate,
  todayISO,
  toRates,
} from "@/lib/mdm";
import { expenseSchema, type ExpenseFormValues } from "@/lib/schemas";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Daily Expenses — Mid-Day Meal Manager" },
      {
        name: "description",
        content:
          "Record daily dal, vegetable, masala and fuel costs, and compare actual expenditure against the sanctioned budget.",
      },
      { property: "og:title", content: "Daily Expenses — Mid-Day Meal Manager" },
      {
        property: "og:description",
        content: "Automatic meal cost calculation with budget and credits saved.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExpensesPage,
});

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 text-sm ${strong ? "font-semibold" : ""}`}
    >
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function ExpensesPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: me } = useQuery(meQuery());
  const { data: settings } = useQuery(settingsQuery());
  const { data: day } = useQuery(dayStatsQuery(date));
  const { data: existing } = useQuery(expenseByDateQuery(date));
  const { data: rateOverrides } = useQuery(classRatesQuery());

  const rates = toRates(settings);
  const present = day?.present ?? 0;

  // Budget is the sum over classes of (present x that class's rate), so a
  // class-level override is reflected here rather than one flat school rate.
  const budgetBreakdown = computeBudget(day?.presentByClass ?? new Map(), rates, rateOverrides);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { dal_rate: 0, veg_rate: 0, misc_cost: 0, misc_note: "" },
  });

  useEffect(() => {
    form.reset({
      dal_rate: num(existing?.dal_rate),
      veg_rate: num(existing?.veg_rate),
      misc_cost: num(existing?.misc_cost),
      misc_note: existing?.misc_note ?? "",
    });
  }, [existing, form]);

  const watched = form.watch();
  const calc = computeExpense(present, rates, {
    dalRate: Number(watched.dal_rate) || 0,
    vegRate: Number(watched.veg_rate) || 0,
    miscCost: Number(watched.misc_cost) || 0,
    budget: budgetBreakdown.totalBudget,
  });

  const save = useMutation({
    mutationFn: async (v: ExpenseFormValues) => {
      // `marked` counts classes resolved from either mode, so a day recorded
      // only with class-wise quick counts passes this guard.
      if (!day?.marked) throw new Error("Mark attendance for this date before recording expenses");
      await saveExpense({
        expense_date: date,
        present_count: present,
        rice_kg: calc.riceKg,
        dal_kg: calc.dalKg,
        veg_kg: calc.vegKg,
        dal_rate: Number(v.dal_rate) || 0,
        veg_rate: Number(v.veg_rate) || 0,
        dal_cost: calc.dalCost,
        veg_cost: calc.vegCost,
        masala_cost: calc.masalaCost,
        fuel_cost: calc.fuelCost,
        misc_cost: calc.miscCost,
        misc_note: v.misc_note?.trim() ? v.misc_note.trim() : null,
        total_expense: calc.totalExpense,
        budget: calc.budget,
        credits_saved: calc.creditsSaved,
      });
      await logAudit("save", "daily_expenses", undefined, { date, total: calc.totalExpense });
    },
    onSuccess: () => {
      toast.success(`Expenses saved for ${prettyDate(date)}`);
      qc.invalidateQueries({ queryKey: ["expense"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await deleteExpense(date);
      await logAudit("delete", "daily_expenses", undefined, { date });
    },
    onSuccess: () => {
      toast.success("Expense record deleted");
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: ["expense"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Daily expenses"
        description={`${prettyDate(date)} · ${present} students present`}
        actions={
          me?.isAdmin && existing ? (
            <Button variant="outline" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1.5 size-4" /> Delete record
            </Button>
          ) : null
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Rice issued"
          value={kg(calc.riceKg)}
          icon={Wheat}
          tone="info"
          hint="Free government supply"
        />
        <StatCard label="Total expense" value={inr(calc.totalExpense)} icon={IndianRupee} />
        <StatCard
          label="Budget"
          value={inr(calc.budget)}
          icon={IndianRupee}
          hint={
            budgetBreakdown.perClass.length > 1
              ? `${budgetBreakdown.perClass.length} classes`
              : `₹${rates.budget_per_student} per student`
          }
        />
        <StatCard
          label="Credits saved"
          value={inr(calc.creditsSaved)}
          icon={PiggyBank}
          tone={calc.creditsSaved >= 0 ? "success" : "danger"}
          hint={calc.creditsSaved < 0 ? "Over budget" : "Within budget"}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Cost entry</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Quantities come from the attendance count. Only rates and extra costs need entry.
          </p>
          <div className="mb-4">
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="exp-date"
            >
              Date
            </label>
            <Input
              id="exp-date"
              type="date"
              max={todayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {!day?.marked && (
              <p className="mt-1.5 text-xs text-destructive">
                Attendance has not been marked for this date yet.
              </p>
            )}
          </div>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => save.mutate(v))}
              className="grid gap-4 sm:grid-cols-2"
            >
              <FormField
                control={form.control}
                name="dal_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dal rate (₹ per kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormDescription>{kg(calc.dalKg)} required today</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="veg_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vegetable rate (₹ per kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormDescription>{kg(calc.vegKg)} required today</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="misc_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other cost (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormDescription>Optional extras such as eggs or fruit</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="misc_note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="What was the extra cost for?"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={save.isPending || !day?.marked}
                  className="w-full sm:w-auto"
                >
                  <Save className="mr-1.5 size-4" />
                  {save.isPending ? "Saving…" : existing ? "Update expenses" : "Save expenses"}
                </Button>
              </div>
            </form>
          </Form>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Auto-calculated breakdown</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Based on {present} present students at {rates.rice_per_student_g} g rice,{" "}
            {rates.dal_per_student_g} g dal and {rates.veg_per_student_g} g vegetables each.
          </p>
          <Line label="Rice quantity (no cost)" value={kg(calc.riceKg)} />
          <Line label={`Dal — ${kg(calc.dalKg)}`} value={inr(calc.dalCost)} />
          <Line label={`Vegetables — ${kg(calc.vegKg)}`} value={inr(calc.vegCost)} />
          <Line
            label={`Masala — ₹${rates.masala_per_student} × ${present}`}
            value={inr(calc.masalaCost)}
          />
          <Line
            label={`Fuel — ₹${rates.fuel_per_student} × ${present}`}
            value={inr(calc.fuelCost)}
          />
          <Line label="Other costs" value={inr(calc.miscCost)} />
          <Separator className="my-2" />
          <Line label="Total expenditure" value={inr(calc.totalExpense)} strong />
          <Line label="Sanctioned budget" value={inr(calc.budget)} strong />
          {budgetBreakdown.perClass.length > 0 && (
            <div className="mt-1 rounded-lg bg-muted/50 px-3 py-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Budget by class</p>
              {budgetBreakdown.perClass.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between py-0.5 text-xs text-muted-foreground"
                >
                  <span>
                    {classLabel(c.className, c.section)} — {c.present} × {inr(c.rate)}
                  </span>
                  <span className="tabular-nums">{inr(c.budget)}</span>
                </div>
              ))}
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
            <span className="text-sm font-semibold">Credits saved</span>
            <span
              className={`text-lg font-bold tabular-nums ${calc.creditsSaved >= 0 ? "text-success" : "text-destructive"}`}
            >
              {inr(calc.creditsSaved)}
            </span>
          </div>
        </Card>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense record?</AlertDialogTitle>
            <AlertDialogDescription>
              The expenditure entry for {prettyDate(date)} will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
