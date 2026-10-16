import { GRACE_DAYS, type AnyPlan } from "@/lib/plans";

/**
 * Subscription state, as a pure function of the school row.
 *
 * Billing is prepaid: a payment buys 12 months and moves `paidUntil`
 * forward. Nothing renews by itself, so there is no mandate to cancel and no
 * card on file. When the year (or trial) ends the school gets GRACE_DAYS of
 * warnings, then the app locks to the billing page. Nothing is deleted;
 * paying unlocks everything as it was.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type BillingStatus = "EXEMPT" | "TRIAL" | "ACTIVE" | "PAST_DUE" | "LOCKED" | "SUSPENDED";

export type BillingSchool = {
  plan: AnyPlan;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  billingExempt: boolean;
  suspendedAt: Date | null;
};

export type BillingState = {
  status: BillingStatus;
  endsAt: Date | null;
  /** Whole days left in the trial/year, or in the grace period when PAST_DUE. */
  daysLeft: number;
  /** The app shows only the billing page. */
  locked: boolean;
};

export function billingState(school: BillingSchool, now = new Date()): BillingState {
  if (school.suspendedAt) return { status: "SUSPENDED", endsAt: null, daysLeft: 0, locked: true };
  if (school.billingExempt) return { status: "EXEMPT", endsAt: null, daysLeft: 0, locked: false };

  const t = now.getTime();
  const paid = school.plan !== "TRIAL" && school.paidUntil ? school.paidUntil : null;
  const endsAt = paid ?? school.trialEndsAt;
  if (!endsAt) return { status: "LOCKED", endsAt: null, daysLeft: 0, locked: true };

  if (endsAt.getTime() > t) {
    return {
      status: paid ? "ACTIVE" : "TRIAL",
      endsAt,
      daysLeft: Math.ceil((endsAt.getTime() - t) / DAY_MS),
      locked: false,
    };
  }

  const graceEnds = endsAt.getTime() + GRACE_DAYS * DAY_MS;
  if (graceEnds > t) {
    return { status: "PAST_DUE", endsAt, daysLeft: Math.ceil((graceEnds - t) / DAY_MS), locked: false };
  }
  return { status: "LOCKED", endsAt, daysLeft: 0, locked: true };
}

/** Calendar months in UTC, clamping the 31st to the month's last day. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * The period a new payment buys. It starts where the current year ends, or
 * where the trial ends (so paying early loses none of the free days), or
 * now if both are over.
 */
export function nextPeriod(school: BillingSchool, months: number, now = new Date()): { start: Date; end: Date } {
  const t = now.getTime();
  let start = now;
  if (school.plan !== "TRIAL" && school.paidUntil && school.paidUntil.getTime() > t) start = school.paidUntil;
  else if (school.plan === "TRIAL" && school.trialEndsAt && school.trialEndsAt.getTime() > t) start = school.trialEndsAt;
  return { start, end: addMonths(start, months) };
}
