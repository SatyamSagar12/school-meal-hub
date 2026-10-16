/**
 * Validated environment. Server-only.
 *
 * The ONLY place permitted to read `process.env`. On Cloudflare, wrangler
 * `vars` and secrets arrive there through the adapter; locally they come
 * from .dev.vars.
 *
 * Parsed on first use rather than at import: Next imports server modules
 * while building, where no secrets exist, and a build must not need them.
 */
import { z } from "zod";

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const optional = <T extends z.ZodType>(type: T) => z.preprocess(blankToUndefined, type.optional());

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  APP_URL: z.url("must be an absolute URL, e.g. http://localhost:3000"),
  APP_NAME: z.string().min(1).default("School Meal Hub"),

  // 32+ chars each. Generate with: openssl rand -base64 32
  SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),
  TOKEN_SECRET: z.string().min(32, "must be at least 32 characters"),

  SIGNUP_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  /** Comma-separated. Also needs a billing-exempt school (see README). */
  PLATFORM_ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),

  // Email through Resend's HTTP API (free tier: 3,000 a month). Unset: reset
  // links are logged instead, and school admins reset teachers' passwords.
  RESEND_API_KEY: optional(z.string().min(1)),
  MAIL_FROM: optional(z.string().min(3)),
  SUPPORT_EMAIL: optional(z.email()),

  // Cloudflare Turnstile on signup. Both or neither.
  TURNSTILE_SITE_KEY: optional(z.string().min(1)),
  TURNSTILE_SECRET_KEY: optional(z.string().min(1)),

  // Manual UPI: zero gateway fee, confirmed by hand on /platform.
  UPI_ID: optional(z.string().regex(/^[\w.-]+@[\w.-]+$/, "must look like name@bank")),
  UPI_PAYEE_NAME: z.string().min(1).default("School Meal Hub"),

  // PhonePe Standard Checkout v2. Optional.
  PHONEPE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  PHONEPE_CLIENT_ID: optional(z.string().min(1)),
  PHONEPE_CLIENT_SECRET: optional(z.string().min(1)),
  PHONEPE_CLIENT_VERSION: z.string().default("1"),
  PHONEPE_WEBHOOK_USERNAME: optional(z.string().min(1)),
  PHONEPE_WEBHOOK_PASSWORD: optional(z.string().min(1)),

  // Shown on the legal pages.
  LEGAL_ENTITY_NAME: optional(z.string().min(1)),
  BUSINESS_ADDRESS: optional(z.string().min(1)),
});

export type Env = z.infer<typeof schema>;

let parsed: Env | null = null;

function load(): Env {
  if (parsed) return parsed;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment:\n${problems}`);
  }
  parsed = result.data;
  return parsed;
}

/** Reads like a plain object; validates the whole environment on first touch. */
export const env = new Proxy({} as Env, {
  get(_target, key: string) {
    return load()[key as keyof Env];
  },
});
