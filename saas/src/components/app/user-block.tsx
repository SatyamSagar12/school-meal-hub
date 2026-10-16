import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";

export function UserBlock({ name, role }: { name: string; role: "ADMIN" | "TEACHER" }) {
  return (
    <div className="flex items-center gap-2 p-2">
      <Link href="/account" className="hover:bg-sidebar-accent min-w-0 flex-1 rounded-md px-2 py-1.5">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="text-sidebar-muted block text-xs">{role === "ADMIN" ? "Admin" : "Teacher"} · Account</span>
      </Link>
      <form action={logoutAction}>
        <button type="submit" aria-label="Sign out" title="Sign out" className="hover:bg-sidebar-accent text-sidebar-muted flex size-9 items-center justify-center rounded-md">
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}
