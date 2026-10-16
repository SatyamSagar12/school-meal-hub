import { Input } from "@/components/ui/input";

export function Field({ label, hint, ...props }: { label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <Input className="h-10" {...props} />
      {hint ? <span className="text-muted-foreground text-xs font-normal">{hint}</span> : null}
    </label>
  );
}

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="bg-destructive-muted text-destructive rounded-lg px-3 py-2 text-sm">
      {message}
    </p>
  );
}
