import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { getSession } from "@/server/auth/session";
import { TRIAL_DAYS } from "@/lib/plans";
import { SignupForm } from "./signup-form";

/** Reads runtime settings (env), which do not exist at build time. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Start your free trial" };

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <>
      <h1 className="text-2xl">Start free for {TRIAL_DAYS} days</h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">No payment now. Set up your school in two minutes.</p>
      {env.SIGNUP_ENABLED ? <SignupForm turnstileSiteKey={env.TURNSTILE_SITE_KEY ?? null} /> : <p className="text-sm">New signups are paused for now.</p>}
      <p className="text-muted-foreground mt-5 text-center text-sm">
        Already registered?{" "}
        <Link href="/login" className="text-foreground font-medium underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
