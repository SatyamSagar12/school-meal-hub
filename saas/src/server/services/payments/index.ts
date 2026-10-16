import "server-only";
import { randomBytes } from "node:crypto";
import { env } from "@/env";
import { db } from "@/server/db";
import { applyPayment, markPaymentFailed } from "@/server/services/billing";
import { PLAN } from "@/lib/plans";
import { createPhonePeCheckout, phonePeConfigured, phonePeOrderStatus } from "@/server/services/payments/phonepe";

/**
 * Checkout orchestration, as in Docchase. The provider module only talks
 * HTTP; every decision about whether a payment counts is here.
 *
 * Two ways to pay, both rupees:
 *  - Manual UPI: the school pays the operator's UPI id from any UPI app and
 *    enters the 12-digit UTR; the operator confirms it on /platform. No
 *    gateway, so no fee at all — the default for a ₹1,499 product.
 *  - PhonePe checkout: instant, at the gateway's fee.
 *
 * The amount always comes from lib/plans.ts on the server, never the form.
 */

export type PaymentMethod = "PHONEPE" | "MANUAL_UPI";

export function availableMethods(): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  if (env.UPI_ID) methods.push("MANUAL_UPI");
  if (phonePeConfigured()) methods.push("PHONEPE");
  return methods;
}

/** PhonePe allows [A-Za-z0-9_-], at most 63 characters. */
function newMerchantOrderId(): string {
  return `MDM${Date.now().toString(36).toUpperCase()}${randomBytes(6).toString("hex").toUpperCase()}`;
}

async function schoolNameOf(schoolId: string): Promise<string | null> {
  const school = await db().school.findUnique({ where: { id: schoolId }, select: { name: true } });
  return school?.name ?? null;
}

export async function startPhonePeCheckout(schoolId: string, userId: string): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: string }> {
  if (!phonePeConfigured()) return { ok: false, error: "Online payment is not available. Pay by UPI instead." };
  const merchantOrderId = newMerchantOrderId();
  const payment = await db().payment.create({
    data: {
      schoolId,
      schoolName: await schoolNameOf(schoolId),
      provider: "PHONEPE",
      months: PLAN.months,
      amountMinor: PLAN.priceMinor,
      merchantOrderId,
      createdById: userId,
    },
    select: { id: true },
  });
  try {
    const checkout = await createPhonePeCheckout({
      merchantOrderId,
      amountPaise: PLAN.priceMinor,
      redirectUrl: `${env.APP_URL}/billing/return?order=${merchantOrderId}`,
      description: `${env.APP_NAME} — 12 months`,
    });
    if (checkout.providerOrderId) {
      await db().payment.update({ where: { id: payment.id }, data: { providerOrderId: checkout.providerOrderId } });
    }
    return { ok: true, redirectUrl: checkout.checkoutUrl };
  } catch (error) {
    console.error("[billing] checkout failed", error);
    await markPaymentFailed(payment.id, "FAILED");
    return { ok: false, error: "Could not reach the payment provider. Please try again in a minute." };
  }
}

export type ConfirmOutcome = "PAID" | "PENDING" | "FAILED" | "UNKNOWN";

/** Asks PhonePe; applies the payment if, and only if, it really completed for the right amount. */
export async function confirmPhonePe(merchantOrderId: string): Promise<ConfirmOutcome> {
  const payment = await db().payment.findUnique({
    where: { merchantOrderId },
    select: { id: true, status: true, provider: true, amountMinor: true },
  });
  if (!payment || payment.provider !== "PHONEPE") return "UNKNOWN";
  if (payment.status === "PAID") return "PAID";
  if (payment.status !== "PENDING") return "FAILED";

  const status = await phonePeOrderStatus(merchantOrderId);
  if (status.state === "COMPLETED") {
    if (status.amountPaise !== payment.amountMinor) {
      console.error("[billing] PhonePe amount mismatch", { merchantOrderId, expected: payment.amountMinor, got: status.amountPaise });
      return "FAILED";
    }
    await applyPayment(payment.id, status.transactionId);
    return "PAID";
  }
  if (status.state === "FAILED") {
    await markPaymentFailed(payment.id, "FAILED");
    return "FAILED";
  }
  return "PENDING";
}

/** The buyer may have paid and closed the tab: re-check recent pending orders when billing loads. */
export async function refreshPendingPayments(schoolId: string): Promise<void> {
  if (!phonePeConfigured()) return;
  const pending = await db().payment.findMany({
    where: { schoolId, status: "PENDING", provider: "PHONEPE", createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
    select: { merchantOrderId: true },
    take: 3,
  });
  for (const p of pending) {
    try {
      await confirmPhonePe(p.merchantOrderId);
    } catch (error) {
      console.error("[billing] refresh failed", error);
    }
  }
}

/* ------------------------------- manual UPI ------------------------------ */

/** UPI reference numbers (UTR) are 12 digits. */
export const UTR_PATTERN = /^\d{12}$/;

export function upiPayUri(note: string): string | null {
  if (!env.UPI_ID) return null;
  const params = new URLSearchParams({
    pa: env.UPI_ID,
    pn: env.UPI_PAYEE_NAME,
    am: (PLAN.priceMinor / 100).toFixed(2),
    cu: "INR",
    tn: note.slice(0, 50),
  });
  return `upi://pay?${params.toString()}`;
}

export async function submitManualUpi(schoolId: string, userId: string, utr: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!env.UPI_ID) return { ok: false, error: "UPI payments are not available." };
  if (!UTR_PATTERN.test(utr)) return { ok: false, error: "Enter the 12-digit UPI reference number (UTR) from your payment app." };

  const waiting = await db().payment.count({ where: { schoolId, provider: "MANUAL_UPI", status: "PENDING" } });
  if (waiting > 0) return { ok: false, error: "A UPI payment is already waiting to be confirmed. We'll update your plan shortly." };

  // A UTR can only ever be claimed once, by anyone.
  const reused = await db().payment.count({ where: { provider: "MANUAL_UPI", providerRef: utr, status: { in: ["PENDING", "PAID"] } } });
  if (reused > 0) return { ok: false, error: "That reference number has already been submitted." };

  await db().payment.create({
    data: {
      schoolId,
      schoolName: await schoolNameOf(schoolId),
      provider: "MANUAL_UPI",
      months: PLAN.months,
      amountMinor: PLAN.priceMinor,
      merchantOrderId: newMerchantOrderId(),
      providerRef: utr,
      createdById: userId,
    },
  });
  return { ok: true };
}
