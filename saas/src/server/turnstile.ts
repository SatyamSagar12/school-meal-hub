import "server-only";
import { env } from "@/env";

/** Cloudflare Turnstile. Free, and it runs on the same platform. Skipped when not configured. */
export async function verifyHuman(token: unknown, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await response.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}
