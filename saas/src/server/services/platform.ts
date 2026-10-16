import "server-only";
import { db } from "@/server/db";
import { billingState } from "@/lib/billing-state";
import { addMonths } from "@/lib/billing-state";

/** The operator's view across every school. Only /platform calls this. */
export async function platformOverview() {
  const [schools, pendingUpi, paidThisYear] = await Promise.all([
    db().school.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        name: true,
        district: true,
        state: true,
        plan: true,
        trialEndsAt: true,
        paidUntil: true,
        billingExempt: true,
        suspendedAt: true,
        createdAt: true,
        users: { where: { role: "ADMIN" }, select: { email: true, name: true, lastLoginAt: true }, take: 1, orderBy: { createdAt: "asc" } },
        _count: { select: { users: true, students: true } },
      },
    }),
    db().payment.findMany({
      where: { provider: "MANUAL_UPI", status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true, schoolName: true, amountMinor: true, providerRef: true, createdAt: true },
    }),
    db().payment.aggregate({
      where: { status: "PAID", paidAt: { gte: addMonths(new Date(), -12) } },
      _sum: { amountMinor: true },
      _count: { _all: true },
    }),
  ]);

  const rows = schools.map((s) => ({ ...s, state: billingState(s), region: s.state }));
  const counts = { total: rows.length, trial: 0, active: 0, pastDue: 0, locked: 0 };
  for (const r of rows) {
    if (r.state.status === "TRIAL") counts.trial++;
    else if (r.state.status === "ACTIVE") counts.active++;
    else if (r.state.status === "PAST_DUE") counts.pastDue++;
    else if (r.state.status === "LOCKED" || r.state.status === "SUSPENDED") counts.locked++;
  }
  return {
    schools: rows,
    pendingUpi,
    counts,
    revenue12m: { amountMinor: paidThisYear._sum.amountMinor ?? 0, payments: paidThisYear._count._all },
  };
}

export async function extendSchool(schoolId: string, days: number): Promise<void> {
  const school = await db().school.findUniqueOrThrow({ where: { id: schoolId }, select: { plan: true, paidUntil: true, trialEndsAt: true } });
  const now = Date.now();
  const ms = days * 24 * 60 * 60 * 1000;
  if (school.plan === "TRIAL") {
    const base = Math.max(now, school.trialEndsAt?.getTime() ?? now);
    await db().school.update({ where: { id: schoolId }, data: { trialEndsAt: new Date(base + ms) } });
  } else {
    const base = Math.max(now, school.paidUntil?.getTime() ?? now);
    await db().school.update({ where: { id: schoolId }, data: { paidUntil: new Date(base + ms) } });
  }
}

export async function setSuspended(schoolId: string, suspended: boolean, reason: string | null): Promise<void> {
  await db().school.update({
    where: { id: schoolId },
    data: suspended ? { suspendedAt: new Date(), suspendReason: reason } : { suspendedAt: null, suspendReason: null },
  });
}
