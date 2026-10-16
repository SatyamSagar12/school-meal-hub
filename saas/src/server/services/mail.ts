import "server-only";
import { env } from "@/env";

/**
 * Transactional email through Resend's HTTP API (a Worker cannot open SMTP
 * sockets the way Docchase's nodemailer does). The free tier, 3,000 emails a
 * month, is far more than password resets for a few hundred teachers need.
 *
 * Unconfigured: the message is logged and false returned, so callers can
 * say "ask your school admin" instead.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    console.log("[mail] not configured; would have sent", { to, subject, text });
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("[mail] send failed", { status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    console.error("[mail] send failed", error);
    return false;
  }
}

export function mailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
}
