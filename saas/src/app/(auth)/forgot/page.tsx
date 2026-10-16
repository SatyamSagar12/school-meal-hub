import { mailConfigured } from "@/server/services/mail";
import { ForgotForm } from "./forgot-form";

/** Reads runtime settings (env), which do not exist at build time. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl">Forgot password</h1>
      {mailConfigured() ? (
        <>
          <p className="text-muted-foreground mt-1 mb-5 text-sm">We&apos;ll email you a link to choose a new one.</p>
          <ForgotForm />
        </>
      ) : null}
      <p className="text-muted-foreground mt-4 text-sm">
        Teachers can also ask their school&apos;s admin, who can give them a new temporary password from Settings.
      </p>
    </>
  );
}
