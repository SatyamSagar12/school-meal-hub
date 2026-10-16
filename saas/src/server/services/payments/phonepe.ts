import "server-only";
import { env } from "@/env";
import { safeEqual, sha256Hex } from "@/server/crypto";

/**
 * PhonePe Payment Gateway, Standard Checkout v2.
 *
 *   1. OAuth client-credentials token (cached until shortly before expiry).
 *   2. POST /checkout/v2/pay  -> a PhonePe-hosted page (UPI, cards, netbanking).
 *   3. PhonePe sends the buyer back to our redirect URL, and calls our webhook.
 *   4. Neither of those is trusted: we always ask GET /checkout/v2/order/{id}/status.
 */

const HOSTS = {
  sandbox: {
    auth: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
    pg: "https://api-preprod.phonepe.com/apis/pg-sandbox",
  },
  production: {
    auth: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
    pg: "https://api.phonepe.com/apis/pg",
  },
} as const;

export function phonePeConfigured(): boolean {
  return Boolean(env.PHONEPE_CLIENT_ID && env.PHONEPE_CLIENT_SECRET);
}

/**
 * Cached per isolate. Workers reuse an isolate across many requests, so
 * this still saves most token calls; a cold isolate simply fetches one.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.value;

  const response = await fetch(HOSTS[env.PHONEPE_ENV].auth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.PHONEPE_CLIENT_ID ?? "",
      client_secret: env.PHONEPE_CLIENT_SECRET ?? "",
      client_version: env.PHONEPE_CLIENT_VERSION,
      grant_type: "client_credentials",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`PhonePe auth failed (${response.status})`);
  const body = (await response.json()) as { access_token?: string; expires_at?: number };
  if (!body.access_token) throw new Error("PhonePe auth returned no token");

  cachedToken = {
    value: body.access_token,
    // expires_at is epoch seconds; fall back to 10 minutes if absent.
    expiresAt: body.expires_at ? body.expires_at * 1000 : Date.now() + 10 * 60_000,
  };
  return cachedToken.value;
}

async function pg(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${HOSTS[env.PHONEPE_ENV].pg}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `O-Bearer ${await accessToken()}`,
      ...init.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
}

/** Creates the checkout and returns the PhonePe page to send the buyer to. */
export async function createPhonePeCheckout(params: {
  merchantOrderId: string;
  amountPaise: number;
  redirectUrl: string;
  description: string;
}): Promise<{ checkoutUrl: string; providerOrderId: string | null }> {
  const response = await pg("/checkout/v2/pay", {
    method: "POST",
    body: JSON.stringify({
      merchantOrderId: params.merchantOrderId,
      amount: params.amountPaise,
      // Thirty minutes to finish paying; the order expires after that.
      expireAfter: 1800,
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: params.description.slice(0, 100),
        merchantUrls: { redirectUrl: params.redirectUrl },
      },
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    orderId?: string;
    redirectUrl?: string;
    message?: string;
  };
  if (!response.ok || !body.redirectUrl) {
    throw new Error(`PhonePe checkout failed (${response.status}${body.message ? `: ${body.message}` : ""})`);
  }
  return { checkoutUrl: body.redirectUrl, providerOrderId: body.orderId ?? null };
}

export type PhonePeStatus = {
  state: "COMPLETED" | "FAILED" | "PENDING";
  amountPaise: number | null;
  transactionId: string | null;
  orderId: string | null;
};

/** The only source of truth for whether money arrived. */
export async function phonePeOrderStatus(merchantOrderId: string): Promise<PhonePeStatus> {
  const response = await pg(`/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status`, {
    method: "GET",
  });
  if (!response.ok) throw new Error(`PhonePe status failed (${response.status})`);
  const body = (await response.json()) as {
    orderId?: string;
    state?: string;
    amount?: number;
    paymentDetails?: { transactionId?: string; state?: string }[];
  };
  const state = body.state === "COMPLETED" || body.state === "FAILED" ? body.state : "PENDING";
  const paid = body.paymentDetails?.find((detail) => detail.state === "COMPLETED") ?? body.paymentDetails?.[0];
  return {
    state,
    amountPaise: typeof body.amount === "number" ? body.amount : null,
    transactionId: paid?.transactionId ?? null,
    orderId: body.orderId ?? null,
  };
}

/**
 * PhonePe signs webhooks with `Authorization: SHA256(username:password)`
 * (hex), using the credentials configured for the webhook in its dashboard.
 * Even when this passes, the handler re-checks the order status itself.
 */
export function verifyPhonePeWebhook(authorization: string | null): boolean {
  if (!env.PHONEPE_WEBHOOK_USERNAME || !env.PHONEPE_WEBHOOK_PASSWORD || !authorization) return false;
  const expected = sha256Hex(`${env.PHONEPE_WEBHOOK_USERNAME}:${env.PHONEPE_WEBHOOK_PASSWORD}`);
  const given = authorization.replace(/^SHA256\s+/i, "").trim().toLowerCase();
  return safeEqual(given, expected);
}
