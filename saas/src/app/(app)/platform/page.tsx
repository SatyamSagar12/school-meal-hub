import { notFound } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { platformOverview } from "@/server/services/platform";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/plans";
import { PlatformActions, UpiActions } from "./platform-actions";

export const metadata = { title: "Platform" };

function day(d: Date | null) {
  return d ? d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" }) : "—";
}

/** The operator's console. Anyone else gets a 404, not a hint that it exists. */
export default async function PlatformPage() {
  const user = await getSession();
  if (!user?.isPlatformAdmin) notFound();
  const data = await platformOverview();

  return (
    <>
      <PageHeader title="Platform" description="Every school, and UPI payments waiting for you to confirm." />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Schools" value={data.counts.total} />
        <StatCard label="On trial" value={data.counts.trial} />
        <StatCard label="Paid" value={data.counts.active} tone="success" />
        <StatCard label="Lapsed / locked" value={data.counts.pastDue + data.counts.locked} tone="danger" />
        <StatCard label="Revenue, last 12 months" value={formatMoney(data.revenue12m.amountMinor)} hint={`${data.revenue12m.payments} payments`} />
      </section>

      <section className="bg-card mt-5 rounded-xl border p-5">
        <h2 className="text-base font-semibold">UPI payments to confirm</h2>
        <p className="text-muted-foreground mb-3 text-sm">Check each UTR in your bank or UPI app before confirming.</p>
        {data.pendingUpi.length === 0 ? (
          <p className="text-muted-foreground text-sm">None waiting.</p>
        ) : (
          <ul className="divide-y">
            {data.pendingUpi.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <strong>{p.schoolName}</strong> · {formatMoney(p.amountMinor)} · UTR <code>{p.providerRef}</code> · {day(p.createdAt)}
                </span>
                <UpiActions paymentId={p.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-card mt-5 overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>School</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead className="text-right">Logins</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.schools.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  {s.name}
                  <span className="text-muted-foreground block text-xs">{[s.district, s.region].filter(Boolean).join(", ")}</span>
                </TableCell>
                <TableCell className="text-xs">
                  {s.users[0]?.name}
                  <span className="text-muted-foreground block">{s.users[0]?.email}</span>
                </TableCell>
                <TableCell className="text-xs">
                  {s.state.status}
                  {s.state.endsAt ? <span className="text-muted-foreground block">until {day(s.state.endsAt)}</span> : null}
                </TableCell>
                <TableCell className="text-right">{s._count.students}</TableCell>
                <TableCell className="text-right">{s._count.users}</TableCell>
                <TableCell className="text-xs">{day(s.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <PlatformActions schoolId={s.id} suspended={Boolean(s.suspendedAt)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
