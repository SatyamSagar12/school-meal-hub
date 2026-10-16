import { LegalPage } from "@/components/marketing/legal-page";
import { legalEntity, TERMS_VERSION } from "@/server/legal";

/** Reads runtime settings (env), which do not exist at build time. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  const e = legalEntity();
  return (
    <LegalPage title="Privacy policy" updated={TERMS_VERSION}>
      <p>
        This explains what {e.appName} ({e.entityName}) stores and why. We collect only what the meal register needs, and we act on the school&apos;s behalf
        for the students&apos; records, as required by the Digital Personal Data Protection Act, 2023.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>Teachers: name, email, a one-way hash of the password, and sign-in times.</li>
        <li>Students, entered by the school: name, admission and roll number, class, and optionally parents&apos; names, date of birth, mobile and address.</li>
        <li>Attendance, meal quantities and costs the school records, and a log of who saved what.</li>
        <li>Payments: amount, date and the UPI or gateway reference. We never see card or bank details.</li>
      </ul>
      <h2>Children&apos;s data</h2>
      <p>
        Student records are entered by the school for running the mid-day meal scheme, and are used for nothing else: no advertising, no profiling, no sale or
        sharing. Only the school&apos;s own logins can see them.
      </p>
      <h2>Where it is kept</h2>
      <p>On Cloudflare&apos;s infrastructure, encrypted in transit and at rest. Emails, when enabled, are sent through a transactional email provider.</p>
      <h2>How long</h2>
      <p>For as long as the school&apos;s account exists. A school can ask for its data to be exported or deleted; deletion is completed within 30 days.</p>
      <h2>Contact</h2>
      <p>Questions or requests: {e.supportEmail ?? "use the contact page"}.</p>
    </LegalPage>
  );
}
