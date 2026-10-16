/**
 * A dependency-free bar chart: one month of days fits in a phone's width,
 * and a charting library would add more to every page load than the whole
 * dashboard. Values are drawn as plain divs; the numbers are in the title.
 */
export function Bars({
  data,
  color = "var(--color-chart-1)",
  secondary,
  format = (n: number) => String(n),
}: {
  data: { label: string; value: number; second?: number }[];
  color?: string;
  /** A paler bar drawn behind (e.g. budget behind spend). */
  secondary?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.second ?? 0)));
  if (!data.length) return <p className="text-muted-foreground py-10 text-center text-sm">Nothing recorded this month yet.</p>;
  return (
    <div className="flex h-40 items-end gap-[3px]" role="img" aria-label="Bar chart">
      {data.map((d) => (
        <div key={d.label} className="relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.label}: ${format(d.value)}${d.second !== undefined ? ` / ${format(d.second)}` : ""}`}>
          {d.second !== undefined && secondary ? (
            <div className="absolute inset-x-0 bottom-0 rounded-t-sm" style={{ height: `${(d.second / max) * 100}%`, background: secondary }} />
          ) : null}
          <div className="relative rounded-t-sm" style={{ height: `${(Math.max(0, d.value) / max) * 100}%`, background: color }} />
        </div>
      ))}
    </div>
  );
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border p-4 shadow-xs">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-muted-foreground mb-3 text-xs">{subtitle}</p>
      {children}
    </div>
  );
}
