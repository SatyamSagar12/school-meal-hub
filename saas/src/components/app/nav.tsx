"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, ClipboardCheck, CreditCard, IndianRupee, LayoutDashboard, Menu, Settings, ShieldCheck, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/expenses", label: "Daily expenses", icon: IndianRupee },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/students", label: "Students", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Plan & billing", icon: CreditCard },
] as const;

export function Sidebar({ showPlatform, onNavigate }: { showPlatform?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = showPlatform ? [...NAV, { href: "/platform", label: "Platform", icon: ShieldCheck }] : NAV;
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-2.5 py-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.875rem] font-medium transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              active ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-muted hover:text-sidebar-foreground",
            )}
          >
            <span
              aria-hidden
              className={cn("bg-sidebar-primary absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-full", active ? "opacity-100" : "opacity-0")}
            />
            <Icon className={cn("size-[1.0625rem] shrink-0", active ? "text-sidebar-primary" : "text-sidebar-muted/80")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone navigation: a full-height dark sheet over the page. */
export function MobileNav({ schoolName, showPlatform }: { schoolName: string; showPlatform?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="hover:bg-muted flex size-9 items-center justify-center rounded-lg"
      >
        <Menu className="size-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="dark bg-sidebar text-sidebar-foreground absolute inset-y-0 left-0 flex w-72 flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <span className="truncate text-sm font-semibold">{schoolName}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex size-8 items-center justify-center rounded-md">
                <X className="size-5" />
              </button>
            </div>
            <Sidebar showPlatform={showPlatform} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
