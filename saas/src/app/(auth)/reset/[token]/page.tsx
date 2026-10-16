import Link from "next/link";
import { checkResetToken } from "@/server/services/account";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[A-Za-z0-9_-]{20,100}$/.test(token) && (await checkResetToken(token));
  return (
    <>
      <h1 className="text-2xl">Choose a new password</h1>
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <p className="mt-3 text-sm">
          This link has expired or was already used.{" "}
          <Link href="/forgot" className="underline">
            Ask for a new one
          </Link>
          .
        </p>
      )}
    </>
  );
}
