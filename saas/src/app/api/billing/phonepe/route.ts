import { NextResponse, type NextRequest } from "next/server";
import { confirmPhonePe } from "@/server/services/payments";
import { verifyPhonePeWebhook } from "@/server/services/payments/phonepe";

/**
 * PhonePe's server-to-server callback. Authenticated by the shared
 * username:password hash, and even then it only triggers a status re-check:
 * nothing in the body is believed.
 */
export async function POST(request: NextRequest) {
  if (!verifyPhonePeWebhook(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { payload?: { merchantOrderId?: string } } | null;
  const order = body?.payload?.merchantOrderId;
  if (typeof order === "string" && /^[A-Za-z0-9_-]{1,63}$/.test(order)) {
    await confirmPhonePe(order).catch((error) => console.error("[billing] webhook confirm failed", error));
  }
  return NextResponse.json({ ok: true });
}
