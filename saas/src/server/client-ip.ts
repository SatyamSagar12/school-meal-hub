import "server-only";
import { headers } from "next/headers";

/** Cloudflare sets this on every request and a client cannot override it. */
export async function clientIp(): Promise<string> {
  return (await headers()).get("cf-connecting-ip") ?? "unknown";
}
