import { LegalPage } from "@/components/marketing/legal-page";
import { legalEntity, TERMS_VERSION } from "@/server/legal";
import { TRIAL_DAYS } from "@/lib/plans";

/** Reads runtime settings (env), which do not exist at build time. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Refunds" };

export default function RefundPage() {
  const e = legalEntity();
  return (
    <LegalPage title="Cancellation and refunds" updated={TERMS_VERSION}>
      <p>Every school gets {TRIAL_DAYS} days free before paying anything, so you can decide with your own data.</p>
      <ul>
        <li>Paid by mistake, or paid twice? Write within 14 days and we refund in full.</li>
        <li>Within 14 days of a yearly payment, if the service is not for you, we refund in full.</li>
        <li>After that, payments for the current year are not refundable, but nothing renews unless you pay again.</li>
        <li>Refunds go back to the account the payment came from, within 7 working days of approval.</li>
      </ul>
      <p>To ask for a refund: {e.supportEmail ?? "use the contact page"}, with your school name and the payment reference.</p>
    </LegalPage>
  );
}
