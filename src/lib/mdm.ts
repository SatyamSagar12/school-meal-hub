import type { Tables } from "@/integrations/supabase/types";

export type Settings = Tables<"settings">;
export type Student = Tables<"students">;
export type Attendance = Tables<"attendance">;
export type DailyExpense = Tables<"daily_expenses">;

export const DEFAULT_SETTINGS = {
  rice_per_student_g: 100,
  dal_per_student_g: 20,
  veg_per_student_g: 50,
  budget_per_student: 6.75,
  masala_per_student: 1.2,
  fuel_per_student: 1,
};

export type MealRates = typeof DEFAULT_SETTINGS;

export function toRates(s?: Settings | null): MealRates {
  if (!s) return DEFAULT_SETTINGS;
  return {
    rice_per_student_g: Number(s.rice_per_student_g),
    dal_per_student_g: Number(s.dal_per_student_g),
    veg_per_student_g: Number(s.veg_per_student_g),
    budget_per_student: Number(s.budget_per_student),
    masala_per_student: Number(s.masala_per_student),
    fuel_per_student: Number(s.fuel_per_student),
  };
}

export interface MealQuantities {
  riceG: number;
  dalG: number;
  vegG: number;
  riceKg: number;
  dalKg: number;
  vegKg: number;
}

/** Grams/kilograms of each ingredient required for `present` students. */
export function computeMeal(present: number, rates: MealRates): MealQuantities {
  const riceG = present * rates.rice_per_student_g;
  const dalG = present * rates.dal_per_student_g;
  const vegG = present * rates.veg_per_student_g;
  return {
    riceG,
    dalG,
    vegG,
    riceKg: round3(riceG / 1000),
    dalKg: round3(dalG / 1000),
    vegKg: round3(vegG / 1000),
  };
}

export interface ExpenseInput {
  dalRate: number;
  vegRate: number;
  miscCost: number;
}

export interface ExpenseBreakdown extends MealQuantities {
  present: number;
  dalCost: number;
  vegCost: number;
  masalaCost: number;
  fuelCost: number;
  miscCost: number;
  totalExpense: number;
  budget: number;
  creditsSaved: number;
}

/**
 * Rice carries no expenditure (government supply) — quantity only.
 * Dal + vegetables are rate-driven; masala and fuel are per-present-student.
 */
export function computeExpense(
  present: number,
  rates: MealRates,
  input: ExpenseInput,
): ExpenseBreakdown {
  const meal = computeMeal(present, rates);
  const dalCost = round2(meal.dalKg * (input.dalRate || 0));
  const vegCost = round2(meal.vegKg * (input.vegRate || 0));
  const masalaCost = round2(present * rates.masala_per_student);
  const fuelCost = round2(present * rates.fuel_per_student);
  const miscCost = round2(input.miscCost || 0);
  const totalExpense = round2(dalCost + vegCost + masalaCost + fuelCost + miscCost);
  const budget = round2(present * rates.budget_per_student);
  return {
    ...meal,
    present,
    dalCost,
    vegCost,
    masalaCost,
    fuelCost,
    miscCost,
    totalExpense,
    budget,
    creditsSaved: round2(budget - totalExpense),
  };
}

export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const round3 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

export const inr = (n: number | string | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const kg = (n: number | string | null | undefined) => `${round3(Number(n ?? 0))} kg`;

export const num = (n: number | string | null | undefined) => Number(n ?? 0);

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthRange(monthISO: string): { start: string; end: string } {
  // monthISO = "YYYY-MM"
  const [y, m] = monthISO.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function currentMonthISO(): string {
  return todayISO().slice(0, 7);
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
