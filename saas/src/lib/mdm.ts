/**
 * Mid-day meal arithmetic. Pure: no database, no React. The browser uses it
 * for live totals while a teacher types; the server uses the SAME functions
 * to compute what it saves, so the two can never disagree.
 *
 * Ported from the single-school app; the rules are unchanged.
 */

/* ------------------------------ meal tiers ------------------------------ */

/**
 * PM POSHAN entitles primary (1-5) and upper primary (6-8) classes to
 * different quantities and cooking-cost rates, so every rate is per tier.
 */
export type Tier = "primary" | "upper_primary";

export const TIERS: Tier[] = ["primary", "upper_primary"];

export const TIER_LABEL: Record<Tier, string> = {
  primary: "Primary (1–5)",
  upper_primary: "Upper Primary (6–8)",
};

/**
 * A leading integer 6-8 means upper primary. Everything else — "LKG", or
 * anything unparseable — falls back to primary, so a class can never drop
 * out of the day's totals because of how it was named. parseInt (not
 * Number) so "6th", "7 A" and "8-B" still map correctly.
 */
export function tierForClass(className: string): Tier {
  const n = Number.parseInt(String(className).trim(), 10);
  return n >= 6 && n <= 8 ? "upper_primary" : "primary";
}

export interface TierRates {
  ricePerStudentG: number;
  dalPerStudentG: number;
  vegPerStudentG: number;
  budgetPerStudent: number;
  masalaPerStudent: number;
  fuelPerStudent: number;
}

export type MealRates = Record<Tier, TierRates>;

export const DEFAULT_RATES: MealRates = {
  primary: {
    ricePerStudentG: 100,
    dalPerStudentG: 20,
    vegPerStudentG: 50,
    budgetPerStudent: 6.78,
    masalaPerStudent: 1.2,
    fuelPerStudent: 1,
  },
  upper_primary: {
    ricePerStudentG: 150,
    dalPerStudentG: 30,
    vegPerStudentG: 75,
    budgetPerStudent: 10.17,
    masalaPerStudent: 1.8,
    fuelPerStudent: 1.5,
  },
};

/** The school row's rate columns. Unsuffixed = primary; `Upper` = upper primary. */
export interface SchoolRates {
  ricePerStudentG: number;
  dalPerStudentG: number;
  vegPerStudentG: number;
  budgetPerStudent: number;
  masalaPerStudent: number;
  fuelPerStudent: number;
  ricePerStudentGUpper: number;
  dalPerStudentGUpper: number;
  vegPerStudentGUpper: number;
  budgetPerStudentUpper: number;
  masalaPerStudentUpper: number;
  fuelPerStudentUpper: number;
}

export function toRates(s: SchoolRates): MealRates {
  return {
    primary: {
      ricePerStudentG: s.ricePerStudentG,
      dalPerStudentG: s.dalPerStudentG,
      vegPerStudentG: s.vegPerStudentG,
      budgetPerStudent: s.budgetPerStudent,
      masalaPerStudent: s.masalaPerStudent,
      fuelPerStudent: s.fuelPerStudent,
    },
    upper_primary: {
      ricePerStudentG: s.ricePerStudentGUpper,
      dalPerStudentG: s.dalPerStudentGUpper,
      vegPerStudentG: s.vegPerStudentGUpper,
      budgetPerStudent: s.budgetPerStudentUpper,
      masalaPerStudent: s.masalaPerStudentUpper,
      fuelPerStudent: s.fuelPerStudentUpper,
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
  const riceG = present * rates.ricePerStudentG;
  const dalG = present * rates.dalPerStudentG;
  const vegG = present * rates.vegPerStudentG;
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

export function compareClasses(a: { className: string; section: string }, b: { className: string; section: string }): number {
  return a.className.localeCompare(b.className, undefined, { numeric: true }) || a.section.localeCompare(b.section);
}

export interface ClassRateOverride {
  className: string;
  section: string;
  budgetPerStudent: number;
}

/**
 * Budget rate for one class: an exact class+section override wins, then a
 * class-wide override (section ""), otherwise that class's tier rate.
 */
export function resolveClassRate(
  className: string,
  section: string,
  rates: MealRates,
  overrides: readonly ClassRateOverride[] = [],
): number {
  const exact = overrides.find((o) => o.className === className && o.section === section);
  if (exact) return exact.budgetPerStudent;
  const classWide = overrides.find((o) => o.className === className && o.section === "");
  if (classWide) return classWide.budgetPerStudent;
  return rates[tierForClass(className)].budgetPerStudent;
}

/**
 * Merge the two attendance sources into one present-count per class.
 *
 * A saved quick count for a class is authoritative and completely replaces
 * the per-student tally for that same class; classes without a quick count
 * fall back to their per-student tally. This is the single place where that
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
  overrides: readonly ClassRateOverride[] = [],
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

  perClass.sort(compareClasses);
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
 * 10 primary + 10 upper primary students need 10x100 + 10x150 g of rice,
 * not 20x100.
 */
export function computeMealByTier(presentByClass: Map<ClassKey, number>, rates: MealRates): MealByTier {
  const presentPerTier: Record<Tier, number> = { primary: 0, upper_primary: 0 };
  for (const [key, present] of presentByClass) {
    presentPerTier[tierForClass(parseClassKey(key).className)] += present;
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
    total: { riceG, dalG, vegG, riceKg: round3(riceG / 1000), dalKg: round3(dalG / 1000), vegKg: round3(vegG / 1000) },
    totalPresent,
  };
}

export interface ExpenseInput {
  dalRate: number;
  vegRate: number;
  miscCost: number;
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
 * Dal and vegetables are bought at one market price each, so the single
 * daily rate applies to the combined kg; only the quantity differs by tier.
 * Masala and fuel are per-student rupee rates, so those sum per tier.
 */
export function computeExpense(
  presentByClass: Map<ClassKey, number>,
  rates: MealRates,
  input: ExpenseInput,
  overrides: readonly ClassRateOverride[] = [],
): ExpenseBreakdown {
  const meal = computeMealByTier(presentByClass, rates);

  const dalCost = round2(meal.total.dalKg * (input.dalRate || 0));
  const vegCost = round2(meal.total.vegKg * (input.vegRate || 0));

  let masala = 0;
  let fuel = 0;
  for (const tier of TIERS) {
    masala += meal.byTier[tier].present * rates[tier].masalaPerStudent;
    fuel += meal.byTier[tier].present * rates[tier].fuelPerStudent;
  }
  const masalaCost = round2(masala);
  const fuelCost = round2(fuel);
  const miscCost = round2(input.miscCost || 0);
  const totalExpense = round2(dalCost + vegCost + masalaCost + fuelCost + miscCost);
  const budget = computeBudget(presentByClass, rates, overrides).totalBudget;

  return {
    ...meal.total,
    present: meal.totalPresent,
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

/* ------------------------------- day totals ------------------------------ */

export interface StudentMark {
  className: string;
  section: string;
  present: boolean;
}

export interface QuickCount {
  className: string;
  section: string;
  presentCount: number;
  enrolledCount: number;
}

export interface DayTotals {
  present: number;
  absent: number;
  /** Classes with any attendance recorded, from either mode. */
  marked: number;
  presentByClass: Map<ClassKey, number>;
}

/**
 * One day's totals from both marking modes. Absent is only counted where
 * the denominator is known: a quick count's enrolled figure, or the number
 * of students marked in that class.
 */
export function dayTotals(marks: readonly StudentMark[], quick: readonly QuickCount[]): DayTotals {
  const studentTally = new Map<ClassKey, number>();
  const studentTotal = new Map<ClassKey, number>();
  for (const m of marks) {
    const key = classKey(m.className, m.section);
    studentTotal.set(key, (studentTotal.get(key) ?? 0) + 1);
    studentTally.set(key, (studentTally.get(key) ?? 0) + (m.present ? 1 : 0));
  }
  const quickCounts = new Map<ClassKey, number>();
  const quickEnrolled = new Map<ClassKey, number>();
  for (const q of quick) {
    const key = classKey(q.className, q.section);
    quickCounts.set(key, q.presentCount);
    quickEnrolled.set(key, q.enrolledCount);
  }

  const presentByClass = resolvePresentByClass(quickCounts, studentTally);
  let present = 0;
  let absent = 0;
  for (const [key, count] of presentByClass) {
    present += count;
    const enrolled = quickCounts.has(key) ? quickEnrolled.get(key) : studentTotal.get(key);
    if (enrolled !== undefined) absent += Math.max(0, enrolled - count);
  }
  return { present, absent, marked: presentByClass.size, presentByClass };
}

/* ---------------------- per-tier view of a saved row ---------------------- */

/** The saved-day fields a report reads. */
export interface SavedExpense {
  date: string;
  presentCount: number;
  presentUpper: number;
  riceKg: number;
  dalKg: number;
  vegKg: number;
  riceKgUpper: number;
  dalKgUpper: number;
  vegKgUpper: number;
  dalCost: number;
  vegCost: number;
  masalaCost: number;
  fuelCost: number;
  miscCost: number;
  totalExpense: number;
  budget: number;
  creditsSaved: number;
}

/** "combined" is the whole school — the grand totals exactly as saved. */
export type ReportScope = "combined" | Tier;

export const REPORT_SCOPES: ReportScope[] = ["combined", "primary", "upper_primary"];

export const REPORT_SCOPE_LABEL: Record<ReportScope, string> = {
  combined: "Combined",
  primary: "Primary (1–5)",
  upper_primary: "Upper Primary (6–8)",
};

export interface ScopedExpenseRow {
  date: string;
  present: number;
  riceKg: number;
  dalKg: number;
  vegKg: number;
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
 * Split a saved daily row into the requested tier.
 *
 * Quantities are exact: the `Upper` columns hold the upper-primary share and
 * the unsuffixed columns are the grand total, so primary = total - upper.
 *
 * Rupee figures are not stored per tier, so they are apportioned: dal/veg by
 * the tier's share of that kg (bought at one market rate), masala, fuel,
 * misc and budget by its share of attendance. The two tier reports therefore
 * always add back up to the combined one.
 */
export function scopeExpenseRow(r: SavedExpense, scope: ReportScope): ScopedExpenseRow {
  if (scope === "combined") {
    return {
      date: r.date,
      present: r.presentCount,
      riceKg: round3(r.riceKg),
      dalKg: round3(r.dalKg),
      vegKg: round3(r.vegKg),
      dalCost: r.dalCost,
      vegCost: r.vegCost,
      masalaCost: r.masalaCost,
      fuelCost: r.fuelCost,
      miscCost: r.miscCost,
      totalExpense: r.totalExpense,
      budget: r.budget,
      creditsSaved: r.creditsSaved,
    };
  }

  const upper = scope === "upper_primary";
  const pick = (total: number, upperPart: number) => (upper ? upperPart : total - upperPart);

  const tierPresent = pick(r.presentCount, r.presentUpper);
  const tierDalKg = pick(r.dalKg, r.dalKgUpper);
  const tierVegKg = pick(r.vegKg, r.vegKgUpper);

  const presentShare = r.presentCount > 0 ? tierPresent / r.presentCount : 0;
  const dalShare = r.dalKg > 0 ? tierDalKg / r.dalKg : 0;
  const vegShare = r.vegKg > 0 ? tierVegKg / r.vegKg : 0;

  const dalCost = round2(r.dalCost * dalShare);
  const vegCost = round2(r.vegCost * vegShare);
  const masalaCost = round2(r.masalaCost * presentShare);
  const fuelCost = round2(r.fuelCost * presentShare);
  const miscCost = round2(r.miscCost * presentShare);
  const budget = round2(r.budget * presentShare);
  const totalExpense = round2(dalCost + vegCost + masalaCost + fuelCost + miscCost);

  return {
    date: r.date,
    present: tierPresent,
    riceKg: round3(pick(r.riceKg, r.riceKgUpper)),
    dalKg: round3(tierDalKg),
    vegKg: round3(tierVegKg),
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

/* -------------------------------- format -------------------------------- */

export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const round3 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

export const inr = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  const s = Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `−₹${s}` : `₹${s}`;
};

export const kg = (n: number | null | undefined) => `${round3(Number(n ?? 0))} kg`;

/* --------------------------------- dates --------------------------------- */

/**
 * Every school using this is in India, and the Worker runs in UTC: "today"
 * must be the Indian calendar day, or attendance marked before 05:30 IST
 * would land on yesterday.
 */
export const SCHOOL_TIME_ZONE = "Asia/Kolkata";

export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_MONTH = /^\d{4}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function monthRange(monthISO: string): { start: string; end: string } {
  const [y, m] = monthISO.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

export function currentMonthISO(): string {
  return todayISO().slice(0, 7);
}

export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function prettyMonth(monthISO: string): string {
  const [y, m] = monthISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { timeZone: "UTC", month: "long", year: "numeric" });
}
