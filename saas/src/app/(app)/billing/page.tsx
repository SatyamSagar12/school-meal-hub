import QRCode from "qrcode";
import { requireUserEvenIfLocked } from "@/server/auth/session";
import { availableMethods, refreshPendingPayments, upiPayUri } from "@/server/services/payments";
import { paymentHistory } from "@/server/services/billing";
import { payOnlineAction } from "@/server/actions/admin";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney, perMonthLabel, PLAN, TRIAL_DAYS } from "@/lib/plans";
import { env } from "@/env";
import { UpiForm } from "./upi-form";

export const metadata = { title: "Plan & billing" };

function day(d: Date | null) {
  return d ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" }) : "—";
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ error?: string; paid?: string }> }) {
  const user = await requireUserEvenIfLocked();
  const sp = await searchParams;
  await refreshPendingPayments(user.schoolId);
  const methods = availableMethods();
  const history = await paymentHistory(user.schoolId);
  const waitingUpi = history.some((p) => p.provider === "MANUAL_UPI" && p.status === "PENDING");
  const uri = upiPayUri(`${user.schoolName} meal hub`.slice(0, 50));
  const qr = uri ? await QRCode.toDataURL(uri, { margin: 1, width: 220 }) : null;
  const s = user.billing;

  const statusLine =
    s.status === "EXEMPT"
      ? "Complimentary account."
      : s.status === "TRIAL"
        ? `Free trial — ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} left (ends ${day(s.endsAt)}).`
        : s.status === "ACTIVE"
          ? `Paid until ${day(s.endsAt)}.`
          : s.status === "PAST_DUE"
            ? `Ended on ${day(s.endsAt)}. The app locks in ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"}.`
            : s.status === "SUSPENDED"
              ? "This school's account is suspended. Contact support."
              : "Your plan has ended. Renew to open your registers again — nothing has been deleted.";

  return (
    <>
      <PageHeader title="Plan & billing" description={statusLine} />
      {sp.error ? <p className="bg-destructive-muted text-destructive mb-4 rounded-lg p-3 text-sm">{sp.error}</p> : null}
      {sp.paid ? <p className="bg-success-muted text-success mb-4 rounded-lg p-3 text-sm">Payment received. Thank you!</p> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <section className="bg-card rounded-xl border p-6">
          <p className="eyebrow text-bronze">{PLAN.name} plan</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {formatMoney(PLAN.priceMinor)} <span className="text-muted-foreground text-base font-normal">/ year</span>
          </p>
          <p className="text-muted-foreground text-sm">That is about {perMonthLabel()}. No auto-renewal, no card kept on file.</p>
          <ul className="mt-4 grid gap-1.5 text-sm">
            {PLAN.features.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-4 text-xs">
            New schools get {TRIAL_DAYS} days free. Paying during the trial adds the year after the trial ends, so no free days are lost.
          </p>
        </section>

        <section className="bg-card rounded-xl border p-6">
          <h2 className="text-base font-semibold">Pay for 12 months</h2>
          {methods.length === 0 ? <p className="text-muted-foreground mt-2 text-sm">Payments are not set up yet. Contact {env.SUPPORT_EMAIL ?? "support"}.</p> : null}

          {methods.includes("MANUAL_UPI") && qr ? (
            <div className="mt-4">
              <p className="text-sm font-medium">UPI — scan with any app (PhonePe, Google Pay, Paytm, BHIM)</p>
              <div className="mt-3 flex flex-wrap items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="UPI QR code" width={160} height={160} className="rounded-lg border bg-white p-1" />
                <div className="grid gap-2 text-sm">
                  <p>
                    Amount: <strong>{formatMoney(PLAN.priceMinor)}</strong>
                  </p>
                  <p>
                    UPI id: <code>{env.UPI_ID}</code>
                  </p>
                  <a href={uri!} className="text-primary underline underline-offset-2 sm:hidden">
                    Open my UPI app
                  </a>
                </div>
              </div>
              {waitingUpi ? (
                <p className="bg-info-muted text-info mt-4 rounded-lg p-3 text-sm">We have your UPI reference and will confirm it shortly (usually within a day).</p>
              ) : (
                <UpiForm />
              )}
            </div>
          ) : null}

          {methods.includes("PHONEPE") ? (
            <form action={payOnlineAction} className="mt-6 border-t pt-5">
              <p className="mb-2 text-sm font-medium">Or pay online (UPI, card, net banking) — confirmed instantly</p>
              <Button type="submit">Pay {formatMoney(PLAN.priceMinor)} online</Button>
            </form>
          ) : null}
        </section>
      </div>

      {history.length ? (
        <section className="bg-card mt-5 rounded-xl border p-5">
          <h2 className="mb-3 text-base font-semibold">Payments</h2>
          <ul className="divide-y text-sm">
            {history.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {day(p.createdAt)} · {formatMoney(p.amountMinor)} · {p.provider === "MANUAL_UPI" ? `UPI ${p.providerRef ?? ""}` : "Online"}
                </span>
                <Badge variant={p.status === "PAID" ? "secondary" : "outline"}>
                  {p.status === "PAID" ? `Paid · until ${day(p.periodEnd)}` : p.status === "PENDING" ? "Being confirmed" : "Not received"}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
