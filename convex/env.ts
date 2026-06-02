import { v } from "convex/values"
import { INTEGRATION_PLUGINS } from "@/convex/plugins/registry"
import { OAUTH_ENV_KEYS } from "@/convex/plugins/oauthEnv"

function requiredStrings(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, v.string()]))
}

const PLUGIN_ENV_KEYS = Array.from(
  new Set(INTEGRATION_PLUGINS.flatMap((plugin) => plugin.env ?? []))
)

export const convexEnv = {
  CLI_AUTH_TOKEN: v.string(),
  SPONSOR_BETTER_AUTH_SECRET: v.string(),
  BETTER_AUTH_SECRET: v.optional(v.string()),
  SITE_URL: v.optional(v.string()),
  SPONSOR_SITE_URL: v.optional(v.string()),
  VITE_SITE_URL: v.optional(v.string()),
  CORS_ALLOWED_ORIGINS: v.optional(v.string()),
  SPONSORSHIP_EMAIL_SENDER_ADDRESS: v.optional(v.string()),
  RESEND_TEST_MODE: v.optional(
    v.union(v.literal("true"), v.literal("false"))
  ),
  ...requiredStrings(OAUTH_ENV_KEYS),
  ...requiredStrings(PLUGIN_ENV_KEYS),
}
