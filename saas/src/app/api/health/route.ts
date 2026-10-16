import { NextResponse } from "next/server";
import { d1 } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await d1().prepare("SELECT 1").first();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
