import "server-only";
import { env } from "@/env";

/** Bump when the terms change materially; new signups record the version they accepted. */
export const TERMS_VERSION = "2026-10-16";

export function legalEntity() {
  return {
    appName: env.APP_NAME,
    entityName: env.LEGAL_ENTITY_NAME ?? env.APP_NAME,
    address: env.BUSINESS_ADDRESS ?? null,
    supportEmail: env.SUPPORT_EMAIL ?? null,
  };
}
