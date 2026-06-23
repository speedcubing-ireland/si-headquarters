import { v } from "convex/values"
import { OPTIONAL_ENV_KEYS, REQUIRED_ENV_KEYS } from "@/convex/envConfig"
import { isFeatureEnabled } from "@/config/lib/organisation"

function requiredStrings(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, v.string()]))
}

function optionalStrings(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, v.optional(v.string())]))
}

export const convexEnv = {
  ...requiredStrings(REQUIRED_ENV_KEYS),
  ...optionalStrings(OPTIONAL_ENV_KEYS),
  DEPLOYMENT_CONTEXT: v.union(v.literal("staging"), v.literal("production")),
  RESEND_TEST_MODE: isFeatureEnabled("sponsors")
    ? v.union(v.literal("true"), v.literal("false"))
    : v.optional(v.union(v.literal("true"), v.literal("false"))),
  BETTER_AUTH_SECRET: v.optional(v.string()),
  VITE_SITE_URL: v.optional(v.string()),
  CORS_ALLOWED_ORIGINS: v.optional(v.string()),
}
