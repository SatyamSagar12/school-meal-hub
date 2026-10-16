import Link from "next/link";
import { requireUserEvenIfLocked } from "@/server/auth/session";
import { BrandMark } from "@/components/app/brand-mark";
import { MobileNav, Sidebar } from "@/components/app/nav";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { UserBlock } from "@/components/app/user-block";
import { BillingBanner } from "@/components/app/billing-banner";
import { Toaster } from "@/components/ui/sonner";

/**
 * The shell for every signed-in page. Each page still calls requireUser()
 * (or requireAdmin) itself: a layout does not re-run on every navigation,
 * so it is not an authorization boundary on its own. Billing and account
 * live inside too, so this uses the variant that tolerates a locked school.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserEvenIfLocked({ allowPasswordChange: true });

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="bg-primary text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>

      <aside className="dark bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r md:flex">
        <Link href="/dashboard" className="flex items-center gap-3 px-5 pt-6 pb-5">
          <BrandMark className="size-9" />
          <span className="min-w-0">
            <span className="block text-[0.9375rem] font-semibold">School Meal Hub</span>
            <span className="text-sidebar-muted block truncate text-xs">{user.schoolName}</span>
          </span>
        </Link>
        <div className="flex-1 overflow-y-auto">
          <Sidebar showPlatform={user.isPlatformAdmin} />
        </div>
        <div className="border-sidebar-border border-t">
          <UserBlock name={user.name} role={user.role} />
        </div>
        <div className="border-sidebar-border flex justify-center border-t p-2.5">
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/85 sticky top-0 z-40 flex items-center justify-between gap-2 border-b p-3 backdrop-blur md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav schoolName={user.schoolName} showPlatform={user.isPlatformAdmin} />
            <Link href="/dashboard" className="truncate text-sm font-semibold">
              {user.schoolName}
            </Link>
          </div>
          <ThemeToggle />
        </header>
        <BillingBanner state={user.billing} />
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
