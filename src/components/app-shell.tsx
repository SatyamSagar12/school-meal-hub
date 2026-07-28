import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun, User2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, settingsQuery } from "@/lib/api";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: settings } = useQuery(settingsQuery());
  const { data: me } = useQuery(meQuery());
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  const initials = (me?.fullName || me?.email || "U").slice(0, 2).toUpperCase();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar schoolName={settings?.school_name ?? "School"} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur-md sm:px-5">
            <SidebarTrigger />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold sm:text-base">
                {settings?.school_name ?? "School"}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Academic year {settings?.academic_year ?? "—"}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle dark mode"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="size-4 dark:hidden" />
              <Moon className="hidden size-4 dark:block" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <span className="brand-gradient flex size-7 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground">
                    {initials}
                  </span>
                  <span className="hidden max-w-32 truncate text-sm sm:inline">
                    {me?.fullName || me?.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium">{me?.fullName || "Staff member"}</p>
                  <p className="truncate text-xs text-muted-foreground">{me?.email}</p>
                  <p className="mt-1 text-xs text-primary">{me?.isAdmin ? "Administrator" : "Staff"}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                  <User2 className="mr-2 size-4" /> Account & settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="fade-up flex-1 px-3 py-4 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
