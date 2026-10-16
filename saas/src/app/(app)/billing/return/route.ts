import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";
import { confirmPhonePe } from "@/server/services/payments";

/**
 * PhonePe sends the buyer back here. The query string is not trusted: the
 * order is re-checked with PhonePe before anything is applied.
 */
export async function GET(request: NextRequest) {
  const order = request.nextUrl.searchParams.get("order") ?? "";
  let outcome = "UNKNOWN";
  if (/^[A-Za-z0-9_-]{1,63}$/.test(order)) {
    try {
      outcome = await confirmPhonePe(order);
    } catch (error) {
      console.error("[billing] return confirm failed", error);
    }
  }
  const target =
    outcome === "PAID"
      ? "/billing?paid=1"
      : outcome === "PENDING"
        ? `/billing?error=${encodeURIComponent("Your payment is still processing. This page will update once PhonePe confirms it.")}`
        : `/billing?error=${encodeURIComponent("The payment did not go through. You have not been charged for this attempt.")}`;
  return NextResponse.redirect(new URL(target, env.APP_URL), 303);
}
