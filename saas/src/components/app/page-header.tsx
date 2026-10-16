export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="border-border mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-5">
      <div className="min-w-0">
        <h1 className="text-[1.875rem] text-balance sm:text-[2.25rem]">{title}</h1>
        {description ? <p className="text-muted-foreground mt-1.5 max-w-prose text-[0.9375rem]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2" data-noprint>{actions}</div> : null}
    </div>
  );
}

/** Empty states always name the next action — never a blank panel. */
export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="bg-card/60 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-sm">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
