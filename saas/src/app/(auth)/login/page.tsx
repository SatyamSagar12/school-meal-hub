import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, safeNextPath } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  if (await getSession()) redirect(safeNextPath(sp.next));
  return (
    <>
      <h1 className="text-2xl">Sign in</h1>
      <p className="text-muted-foreground mt-1 mb-5 text-sm">To your school&apos;s meal register.</p>
      {sp.reset ? <p className="bg-success-muted text-success mb-4 rounded-lg px-3 py-2 text-sm">Password changed. Sign in with the new one.</p> : null}
      <LoginForm next={safeNextPath(sp.next)} />
      <p className="text-muted-foreground mt-5 text-center text-sm">
        New school?{" "}
        <Link href="/signup" className="text-foreground font-medium underline-offset-2 hover:underline">
          Start a free trial
        </Link>
      </p>
    </>
  );
}
