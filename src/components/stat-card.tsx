import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  loading,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "danger" | "info" | "warning";
  loading?: boolean;
}) {
  const toneMap = {
    default: "text-foreground",
    success: "text-success",
    danger: "text-destructive",
    info: "text-info",
    warning: "text-warning",
  } as const;

  const iconTone = {
    default: "bg-secondary text-secondary-foreground",
    success: "bg-success/12 text-success",
    danger: "bg-destructive/12 text-destructive",
    info: "bg-info/12 text-info",
    warning: "bg-warning/15 text-warning",
  } as const;

  return (
    <Card className="gap-0 p-4 shadow-card transition-shadow hover:shadow-float">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", toneMap[tone])}>
              {value}
            </p>
          )}
          {hint && !loading && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              iconTone[tone],
            )}
          >
            <Icon className="size-4.5" />
          </span>
        )}
      </div>
    </Card>
  );
}
