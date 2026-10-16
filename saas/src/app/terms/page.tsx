import { LegalPage } from "@/components/marketing/legal-page";
import { legalEntity, TERMS_VERSION } from "@/server/legal";
import { formatMoney, GRACE_DAYS, PLAN, TRIAL_DAYS } from "@/lib/plans";

/** Reads runtime settings (env), which do not exist at build time. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  const e = legalEntity();
  return (
    <LegalPage title="Terms of service" updated={TERMS_VERSION}>
      <p>
        {e.appName} is provided by {e.entityName}
        {e.address ? `, ${e.address}` : ""}. By creating an account you agree to these terms on behalf of yourself and your school.
      </p>
      <h2>The service</h2>
      <p>
        {e.appName} helps a school keep its mid-day meal records: attendance, food quantities, daily costs and reports. It calculates from the norms and prices
        you enter. You remain responsible for the figures you submit to any authority; check them against your official records.
      </p>
      <h2>Accounts</h2>
      <ul>
        <li>The person who signs up becomes the school&apos;s admin and may add up to {PLAN.maxUsers} logins in total.</li>
        <li>Keep passwords private. Tell us at once if you think an account has been misused.</li>
        <li>Do not use the service for anything unlawful, or try to reach another school&apos;s data.</li>
      </ul>
      <h2>Trial, price and payment</h2>
      <ul>
        <li>New schools get {TRIAL_DAYS} days free.</li>
        <li>After that the price is {formatMoney(PLAN.priceMinor)} for 12 months per school, paid in advance. Nothing renews automatically.</li>
        <li>If a year ends unpaid, the school has {GRACE_DAYS} days&apos; grace, then the app locks until payment. Data is kept, not deleted.</li>
        <li>We may change the price for future years and will tell you before your year ends.</li>
      </ul>
      <h2>Your data</h2>
      <p>The records you enter belong to your school. See the privacy policy for how we handle them. You can ask for an export or for deletion at any time.</p>
      <h2>Availability and liability</h2>
      <p>
        We work to keep the service available and your data safe but cannot promise it will never be interrupted. To the extent the law allows, our total
        liability is limited to what your school paid us in the 12 months before the claim.
      </p>
      <h2>Ending</h2>
      <p>You may stop using the service at any time. We may suspend an account that breaks these terms. Disputes are subject to the courts of India.</p>
    </LegalPage>
  );
}
