import "server-only";
import { db } from "@/server/db";
import { computeExpense, type ExpenseInput } from "@/lib/mdm";
import { dayTotalsFor } from "@/server/services/attendance";
import { mealContext } from "@/server/services/school";

export async function getExpense(schoolId: string, date: string) {
  return db().dailyExpense.findUnique({ where: { schoolId_date: { schoolId, date } } });
}

export async function expensesRange(schoolId: string, start: string, end: string) {
  return db().dailyExpense.findMany({
    where: { schoolId, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
}

export type SaveExpenseResult = { ok: true; totalExpense: number } | { ok: false; message: string };

/**
 * Records a day's costs. Every derived figure is computed HERE from the
 * saved attendance and the school's own rates — the form sends only the
 * dal and vegetable prices and any extra cost. A tampered request can
 * change what the teacher typed, never the arithmetic.
 */
export async function saveExpense(
  schoolId: string,
  userId: string,
  date: string,
  input: ExpenseInput & { miscNote: string | null },
): Promise<SaveExpenseResult> {
  const [day, ctx] = await Promise.all([dayTotalsFor(schoolId, date), mealContext(schoolId)]);
  if (!day.marked) return { ok: false, message: "Mark attendance for this date before recording expenses." };

  const calc = computeExpense(day.presentByClass, ctx.rates, input, ctx.overrides);
  const data = {
    presentCount: calc.present,
    presentPrimary: calc.byTier.primary.present,
    presentUpper: calc.byTier.upper_primary.present,
    riceKg: calc.riceKg,
    dalKg: calc.dalKg,
    vegKg: calc.vegKg,
    riceKgUpper: calc.byTier.upper_primary.riceKg,
    dalKgUpper: calc.byTier.upper_primary.dalKg,
    vegKgUpper: calc.byTier.upper_primary.vegKg,
    dalRate: input.dalRate,
    vegRate: input.vegRate,
    dalCost: calc.dalCost,
    vegCost: calc.vegCost,
    masalaCost: calc.masalaCost,
    fuelCost: calc.fuelCost,
    miscCost: calc.miscCost,
    miscNote: input.miscNote,
    totalExpense: calc.totalExpense,
    budget: calc.budget,
    creditsSaved: calc.creditsSaved,
    createdById: userId,
  };
  await db().dailyExpense.upsert({
    where: { schoolId_date: { schoolId, date } },
    create: { schoolId, date, ...data },
    update: data,
  });
  return { ok: true, totalExpense: calc.totalExpense };
}

export async function deleteExpense(schoolId: string, date: string): Promise<boolean> {
  const { count } = await db().dailyExpense.deleteMany({ where: { schoolId, date } });
  return count === 1;
}
