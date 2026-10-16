import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/**
 * Static security headers. There is no per-request CSP nonce here (Docchase
 * builds one in proxy.ts): Next 16's proxy runs on the Node runtime, which
 * the Cloudflare adapter does not run, so the policy is static instead.
 * Inline scripts are still allowed because Next's own bootstrap needs them;
 * everything else is pinned to this origin plus Turnstile.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self' https://*.phonepe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Reset links carry a token: never leak one in a Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // This app lives in a subfolder of a repo with its own lockfile.
  turbopack: { root: import.meta.dirname },
  poweredByHeader: false,
  /**
   * Prisma's generated client loads its query compiler with a dynamic path,
   * so the file tracer conservatively ships the Prisma CLI, a Postgres-in-WASM
   * and the compiler for every database Prisma supports — about 50 MB the
   * Worker would have to load on a cold start. Only SQLite's is ever used.
   */
  outputFileTracingExcludes: {
    "*": [
      "node_modules/prisma/**",
      "node_modules/@prisma/dev/**",
      "node_modules/@prisma/studio-core/**",
      "node_modules/@electric-sql/**",
      "node_modules/@prisma/client/runtime/*.{mysql,postgresql,sqlserver,cockroachdb}.*",
      "src/generated/prisma/internal/*.{mysql,postgresql,sqlserver,cockroachdb}.*",
      "node_modules/@prisma/client/runtime/query_compiler_small*",
      "node_modules/wrangler/**",
      "node_modules/miniflare/**",
      "node_modules/@opennextjs/**",
      "node_modules/@img/**",
      "node_modules/sharp/**",
    ],
  },
  experimental: {
    // Forms carry JSON and a small Excel import at most.
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

// `next dev` gets the same bindings (D1 included, backed by a local SQLite
// file under .wrangler/) that the deployed Worker has.
initOpenNextCloudflareForDev();
