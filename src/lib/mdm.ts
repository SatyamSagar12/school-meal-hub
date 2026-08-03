import type { Tables } from "@/integrations/supabase/types";

export type Settings = Tables<"settings">;
export type Student = Tables<"students">;
export type Attendance = Tables<"attendance">;
export type ClassAttendance = Tables<"class_attendance">;
export type ClassRate = Tables<"class_rates">;
export type DailyExpense = Tables<"daily_expenses">;

/* ------------------------------ meal tiers ------------------------------ */

/**
 * The mid-day meal scheme entitles primary (1-5) and upper primary (6-8)
 * classes to different quantities and different cooking-cost rates, so every
 * rate below is held per tier rather than once for the school.
 */
export type Tier = "primary" | "upper_primary";

export const TIERS: Tier[] = ["primary", "upper_primary"];

export const TIER_LABEL: Record<Tier, string> = {
  primary: "Primary (1–5)",
  upper_primary: "Upper Primary (6–8)",
};

/**
 * A leading integer 6-8 means upper primary. Everything else — pre-primary
 * names like "LKG", or anything unparseable — falls back to primary, so a
 * class can never drop out of the day's totals because of how it was named.
 * parseInt (not Number) so "6th", "7 A" and "8-B" still map correctly.
 */
export function tierForClass(className: string): Tier {
  const n = Number.parseInt(String(className).trim(), 10);
  return n >= 6 && n <= 8 ? "upper_primary" : "primary";
}

export interface TierRates {
  rice_per_student_g: number;
  dal_per_student_g: number;
  veg_per_student_g: number;
  budget_per_student: number;
  masala_per_student: number;
  fuel_per_student: number;
}

export type MealRates = Record<Tier, TierRates>;

export const DEFAULT_SETTINGS: MealRates = {
  primary: {
    rice_per_student_g: 100,
    dal_per_student_g: 20,
    veg_per_student_g: 50,
    budget_per_student: 6.78,
    masala_per_student: 1.2,
    fuel_per_student: 1,
  },
  upper_primary: {
    rice_per_student_g: 150,
    dal_per_student_g: 30,
    veg_per_student_g: 75,
    budget_per_student: 10.17,
    masala_per_student: 1.8,
    fuel_per_student: 1.5,
  },
};

/** The unsuffixed settings columns are the primary tier; `*_upper` the other. */
export function toRates(s?: Settings | null): MealRates {
  if (!s) return DEFAULT_SETTINGS;
  return {
    primary: {
      rice_per_student_g: Number(s.rice_per_student_g),
      dal_per_student_g: Number(s.dal_per_student_g),
      veg_per_student_g: Number(s.veg_per_student_g),
      budget_per_student: Number(s.budget_per_student),
      masala_per_student: Number(s.masala_per_student),
      fuel_per_student: Number(s.fuel_per_student),
    },
    upper_primary: {
      rice_per_student_g: Number(s.rice_per_student_g_upper),
      dal_per_student_g: Number(s.dal_per_student_g_upper),
      veg_per_student_g: Number(s.veg_per_student_g_upper),
      budget_per_student: Number(s.budget_per_student_upper),
      masala_per_student: Number(s.masala_per_student_upper),
      fuel_per_student: Number(s.fuel_per_student_upper),
    },
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

/** Grams/kilograms of each ingredient for `present` students at one tier's rates. */
export function computeMeal(present: number, rates: TierRates): MealQuantities {
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

/* --------------------- class-wise attendance + budget -------------------- */

/** Stable map key for a class/section pair, so lookups cannot drift. */
export type ClassKey = string;

export function classKey(className: string, section: string): ClassKey {
  return `${className}|${section}`;
}

export function parseClassKey(key: ClassKey): { className: string; section: string } {
  const [className, section = ""] = key.split("|");
  return { className, section };
}

export function classLabel(className: string, section: string): string {
  return section ? `${className}-${section}` : className;
}

/**
 * Budget rate for one class: an exact class+section override wins, then a
 * class-wide override (section ''), otherwise that class's tier rate.
 *
 * The `class_rates` overrides predate tiers and still take precedence, so a
 * school that had tuned an individual class keeps that number.
 */
export function resolveClassRate(
  className: string,
  section: string,
  rates: MealRates,
  overrides?: ClassRate[] | null,
): number {
  const list = overrides ?? [];
  const exact = list.find((o) => o.class_name === className && o.section === section);
  if (exact) return Number(exact.budget_per_student);
  const classWide = list.find((o) => o.class_name === className && o.section === "");
  if (classWide) return Number(classWide.budget_per_student);
  return rates[tierForClass(className)].budget_per_student;
}

/**
 * Merge the two attendance sources into one present-count per class.
 *
 * A saved quick count for a class is authoritative and completely replaces the
 * per-student tally for that same class; classes without a quick count fall
 * back to their per-student tally. This is the single place where that
 * precedence is decided — every consumer must read the result rather than
 * combining the two sources itself, or counts will be double-added.
 */
export function resolvePresentByClass(
  quickCounts: Map<ClassKey, number>,
  studentTally: Map<ClassKey, number>,
): Map<ClassKey, number> {
  const merged = new Map<ClassKey, number>(studentTally);
  for (const [key, count] of quickCounts) merged.set(key, count);
  return merged;
}

export interface ClassBudgetLine {
  key: ClassKey;
  className: string;
  section: string;
  present: number;
  rate: number;
  budget: number;
}

export interface BudgetBreakdown {
  totalPresent: number;
  totalBudget: number;
  perClass: ClassBudgetLine[];
}

/** Day's budget as the sum over classes of (present in class x that class's rate). */
export function computeBudget(
  presentByClass: Map<ClassKey, number>,
  rates: MealRates,
  overrides?: ClassRate[] | null,
): BudgetBreakdown {
  const perClass: ClassBudgetLine[] = [];
  let totalPresent = 0;
  let totalBudget = 0;

  for (const [key, present] of presentByClass) {
    const { className, section } = parseClassKey(key);
    const rate = resolveClassRate(className, section, rates, overrides);
    const budget = round2(present * rate);
    perClass.push({ key, className, section, present, rate, budget });
    totalPresent += present;
    totalBudget += budget;
  }

  perClass.sort(
    (a, b) =>
      a.className.localeCompare(b.className, undefined, { numeric: true }) ||
      a.section.localeCompare(b.section),
  );

  return { totalPresent, totalBudget: round2(totalBudget), perClass };
}

export interface TierMeal extends MealQuantities {
  tier: Tier;
  present: number;
}

export interface MealByTier {
  byTier: Record<Tier, TierMeal>;
  /** Grand total across tiers — what actually gets cooked and purchased. */
  total: MealQuantities;
  totalPresent: number;
}

/**
 * Bucket the day's classes into tiers, apply each tier's own grams, and sum.
 * This is the whole point of tiering: 10 primary + 10 upper primary students
 * need 10x100 + 10x150 g of rice, not 20x100.
 */
export function computeMealByTier(
  presentByClass: Map<ClassKey, number>,
  rates: MealRates,
): MealByTier {
  const presentPerTier: Record<Tier, number> = { primary: 0, upper_primary: 0 };
  for (const [key, present] of presentByClass) {
    const { className } = parseClassKey(key);
    presentPerTier[tierForClass(className)] += present;
  }

  const byTier = {} as Record<Tier, TierMeal>;
  let riceG = 0;
  let dalG = 0;
  let vegG = 0;
  let totalPresent = 0;

  for (const tier of TIERS) {
    const present = presentPerTier[tier];
    byTier[tier] = { tier, present, ...computeMeal(present, rates[tier]) };
    riceG += byTier[tier].riceG;
    dalG += byTier[tier].dalG;
    vegG += byTier[tier].vegG;
    totalPresent += present;
  }

  return {
    byTier,
    total: {
      riceG,
      dalG,
      vegG,
      riceKg: round3(riceG / 1000),
      dalKg: round3(dalG / 1000),
      vegKg: round3(vegG / 1000),
    },
    totalPresent,
  };
}

export interface ExpenseInput {
  dalRate: number;
  vegRate: number;
  miscCost: number;
  /** Precomputed per-class budget. Derived from the tier rates when omitted. */
  budget?: number;
}

export interface ExpenseBreakdown extends MealQuantities {
  present: number;
  byTier: Record<Tier, TierMeal>;
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
 *
 * Dal and vegetables are bought at one market price each, so the single daily
 * rate applies to the combined kg; only the quantity differs by tier. Masala
 * and fuel are per-student rupee rates, so those do sum per tier.
 */
export function computeExpense(
  presentByClass: Map<ClassKey, number>,
  rates: MealRates,
  input: ExpenseInput,
  overrides?: ClassRate[] | null,
): ExpenseBreakdown {
  const meal = computeMealByTier(presentByClass, rates);
  const present = meal.totalPresent;

  const dalCost = round2(meal.total.dalKg * (input.dalRate || 0));
  const vegCost = round2(meal.total.vegKg * (input.vegRate || 0));

  let masala = 0;
  let fuel = 0;
  for (const tier of TIERS) {
    masala += meal.byTier[tier].present * rates[tier].masala_per_student;
    fuel += meal.byTier[tier].present * rates[tier].fuel_per_student;
  }
  const masalaCost = round2(masala);
  const fuelCost = round2(fuel);

  const miscCost = round2(input.miscCost || 0);
  const totalExpense = round2(dalCost + vegCost + masalaCost + fuelCost + miscCost);
  const budget =
    input.budget === undefined
      ? computeBudget(presentByClass, rates, overrides).totalBudget
      : round2(input.budget);

  return {
    ...meal.total,
    present,
    byTier: meal.byTier,
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
