import { requireUser } from "@/server/auth/session";
import { dayTotalsFor } from "@/server/services/attendance";
import { getExpense } from "@/server/services/expenses";
import { mealContext } from "@/server/services/school";
import { isIsoDate, todayISO } from "@/lib/mdm";
import { ExpensesClient } from "./expenses-client";

export const metadata = { title: "Daily expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const date = isIsoDate(sp.date) && sp.date <= today ? sp.date : today;
  const [day, existing, ctx] = await Promise.all([dayTotalsFor(user.schoolId, date), getExpense(user.schoolId, date), mealContext(user.schoolId)]);

  return (
    <ExpensesClient
      key={date}
      date={date}
      today={today}
      isAdmin={user.role === "ADMIN"}
      marked={day.marked > 0}
      presentByClass={[...day.presentByClass.entries()]}
      existing={existing ? { dalRate: existing.dalRate, vegRate: existing.vegRate, miscCost: existing.miscCost, miscNote: existing.miscNote } : null}
      rates={ctx.rates}
      overrides={ctx.overrides}
    />
  );
}
