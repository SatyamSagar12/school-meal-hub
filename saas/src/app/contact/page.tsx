import { LegalPage } from "@/components/marketing/legal-page";
import { legalEntity, TERMS_VERSION } from "@/server/legal";

/** Reads runtime settings (env), which do not exist at build time. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  const e = legalEntity();
  return (
    <LegalPage title="Contact" updated={TERMS_VERSION}>
      <p>{e.entityName}</p>
      {e.address ? <p>{e.address}</p> : null}
      <p>Email: {e.supportEmail ?? "—"}</p>
      <p>We reply within two working days.</p>
    </LegalPage>
  );
}
