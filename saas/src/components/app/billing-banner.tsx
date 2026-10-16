import Link from "next/link";
import type { BillingState } from "@/lib/billing-state";

/** One line across the top when the trial or paid year is ending. Silent otherwise. */
export function BillingBanner({ state }: { state: BillingState }) {
  let text: string | null = null;
  let urgent = false;
  if (state.status === "TRIAL" && state.daysLeft <= 10) {
    text = `Free trial: ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"} left.`;
  } else if (state.status === "ACTIVE" && state.daysLeft <= 15) {
    text = `Your plan ends in ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"}.`;
  } else if (state.status === "PAST_DUE") {
    text = `Your plan has ended. The app locks in ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"}; your data stays safe.`;
    urgent = true;
  }
  if (!text) return null;
  return (
    <div className={urgent ? "bg-destructive-muted text-destructive" : "bg-warning-muted text-warning"} data-noprint>
      <p className="mx-auto max-w-7xl px-4 py-2 text-sm font-medium sm:px-8">
        {text}{" "}
        <Link href="/billing" className="underline underline-offset-2">
          Renew for the year
        </Link>
      </p>
    </div>
  );
}
