import { cn } from "@/lib/utils";

const TONES = {
  default: "",
  success: "text-success",
  danger: "text-destructive",
  info: "text-info",
} as const;

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-xs">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", TONES[tone])} data-numeric>
        {value}
      </p>
      {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}
