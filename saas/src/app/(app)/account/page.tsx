import { requireUserEvenIfLocked } from "@/server/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const user = await requireUserEvenIfLocked({ allowPasswordChange: true });
  const first = user.mustChangePassword || Boolean((await searchParams).first);
  return (
    <>
      <PageHeader
        title="Your account"
        description={first ? "Your admin gave you a temporary password. Choose your own to continue." : `${user.name} · ${user.email}`}
      />
      <section className="bg-card max-w-md rounded-xl border p-5">
        <h2 className="mb-4 text-base font-semibold">Change password</h2>
        <ChangePasswordForm currentLabel={first ? "Temporary password" : "Current password"} />
      </section>
    </>
  );
}
