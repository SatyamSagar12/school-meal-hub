import "server-only";
import { db } from "@/server/db";
import { nextPeriod } from "@/lib/billing-state";

/**
 * Applies a payment: marks it PAID and moves the school's paid year forward.
 *
 * Idempotent and race-safe without a transaction (D1 has none): the first
 * write is a conditional update PENDING -> PAID, and D1 runs writes one at
 * a time, so when a webhook and a browser return arrive together exactly
 * one of them sees count === 1 and extends the school.
 *
 * Returns false when the payment was already applied or is not PENDING.
 */
export async function applyPayment(paymentId: string, providerRef: string | null, note?: string): Promise<boolean> {
  const { count } = await db().payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date(), ...(providerRef ? { providerRef } : {}), ...(note ? { note } : {}) },
  });
  if (count !== 1) return false;

  const payment = await db().payment.findUniqueOrThrow({ where: { id: paymentId }, select: { schoolId: true, months: true } });
  if (!payment.schoolId) return true;
  const school = await db().school.findUniqueOrThrow({
    where: { id: payment.schoolId },
    select: { plan: true, trialEndsAt: true, paidUntil: true, billingExempt: true, suspendedAt: true },
  });
  const period = nextPeriod(school, payment.months);
  await db().school.update({ where: { id: payment.schoolId }, data: { plan: "SCHOOL", paidUntil: period.end } });
  await db().payment.update({ where: { id: paymentId }, data: { periodStart: period.start, periodEnd: period.end } });
  return true;
}

export async function markPaymentFailed(paymentId: string, status: "FAILED" | "CANCELLED", note?: string): Promise<void> {
  await db().payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status, ...(note ? { note } : {}) } });
}

export async function paymentHistory(schoolId: string) {
  return db().payment.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, provider: true, status: true, amountMinor: true, providerRef: true, createdAt: true, periodEnd: true },
  });
}
