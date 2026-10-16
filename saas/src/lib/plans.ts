/**
 * The plan, its price and its limits. No server dependencies: the landing
 * page, the billing page and the server all read this one table.
 *
 * Prices are in paise so no float ever reaches a payment provider. Changing
 * the price here changes it for the NEXT payment only; what a school already
 * paid is recorded on its Payment rows.
 */

export type PaidPlan = "SCHOOL";
export type AnyPlan = PaidPlan | "TRIAL";

/** Long enough to cover one full month's report cycle before paying. */
export const TRIAL_DAYS = 30;
/** Days after the paid year (or trial) ends before the school locks. */
export const GRACE_DAYS = 7;

export const PLAN = {
  key: "SCHOOL" as PaidPlan,
  name: "School",
  /** ₹1,499 for 12 months. */
  priceMinor: 1_499_00,
  months: 12,
  /** Teacher logins per school, the admin included. */
  maxUsers: 5,
  features: [
    "Up to 5 teacher logins",
    "Unlimited students and classes",
    "Quick-count and student-wise attendance",
    "Primary and upper-primary meal norms",
    "Daily cost, budget and savings",
    "Monthly reports in Excel and PDF",
  ],
} as const;

export function limitsFor(plan: AnyPlan): { maxUsers: number } {
  void plan;
  return { maxUsers: PLAN.maxUsers };
}

/** "₹1,499" — whole rupees when there are no paise. */
export function formatMoney(minor: number): string {
  const major = minor / 100;
  const whole = Number.isInteger(major);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/** "₹125 a month" — display only; the charge is always the year's price. */
export function perMonthLabel(): string {
  return `${formatMoney(Math.round(PLAN.priceMinor / 12 / 100) * 100)} a month`;
}
