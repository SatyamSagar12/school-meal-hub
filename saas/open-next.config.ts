import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Every page reads the signed-in school's data, so nothing is statically
 * cached and no incremental-cache bucket (R2/KV) is needed — one fewer
 * thing to pay for or provision.
 */
export default defineCloudflareConfig({});
